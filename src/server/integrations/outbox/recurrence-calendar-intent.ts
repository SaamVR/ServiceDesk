import type { Result, VisitDTO } from "../../../contracts";
import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { OutboxJob } from "../types";
import type { CalendarCrewBinding, ServiceDeskManagedVisitCalendarProjection } from "../google-calendar/visit-projection-bridge";
import { buildServiceDeskManagedVisitCalendarProjection } from "../google-calendar/visit-projection-bridge";
import { buildCalendarVisitOutboxJob } from "./calendar-visit-intent";

export interface MaterializedRecurrenceVisitAuthoritativeSource {
  eventId: string;
  workspaceId: string;
  recurrenceRuleId: string;
  occurrenceSequence: number;
  visit: VisitDTO;
  binding: CalendarCrewBinding;
  summary: string;
  idempotencyKey: string;
  providerEventId?: string;
}

export interface MaterializedRecurrenceVisitSourcePort {
  load(event: ClaimedOutboxEvent): Promise<Result<MaterializedRecurrenceVisitAuthoritativeSource>>;
}

export interface MaterializedRecurrenceCalendarJob {
  job: OutboxJob;
  projection: ServiceDeskManagedVisitCalendarProjection;
  recurrenceRuleId: string;
  occurrenceSequence: number;
  canMutateRecurrenceTruth: false;
  googleCalendarSeriesMode: "NO_RRULE_SERIES";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberField(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function nonblank(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildMaterializedRecurrenceCalendarJob(
  event: ClaimedOutboxEvent,
  source: MaterializedRecurrenceVisitAuthoritativeSource,
): Result<MaterializedRecurrenceCalendarJob> {
  if (source.eventId !== event.id || source.workspaceId !== event.workspaceId || source.visit.workspaceId !== event.workspaceId) {
    return { ok: false, code: "RECURRENCE_VISIT_IDENTITY_MISMATCH", message: "Authoritative recurrence occurrence did not match claimed outbox event identity." };
  }
  if (!nonblank(source.recurrenceRuleId) || !Number.isInteger(source.occurrenceSequence) || source.occurrenceSequence < 0) {
    return { ok: false, code: "RECURRENCE_OCCURRENCE_INVALID", message: "Materialized recurrence visit must include recurrenceRuleId and non-negative occurrence sequence." };
  }

  const projection = buildServiceDeskManagedVisitCalendarProjection({
    action: "UPSERT",
    visit: source.visit,
    binding: source.binding,
    summary: source.summary,
    idempotencyKey: source.idempotencyKey,
    providerEventId: source.providerEventId,
  });
  if (!projection.ok) return projection;

  const job = buildCalendarVisitOutboxJob(event, projection.value);
  const recurrence = {
    recurrenceRuleId: source.recurrenceRuleId,
    occurrenceSequence: source.occurrenceSequence,
    visitId: source.visit.id,
    canMutateRecurrenceTruth: false,
    googleCalendarSeriesMode: "NO_RRULE_SERIES" as const,
  };

  return {
    ok: true,
    value: {
      job: {
        ...job,
        idempotencyKey: source.idempotencyKey,
        payload: {
          ...job.payload,
          recurrence,
        },
      },
      projection: projection.value,
      recurrenceRuleId: source.recurrenceRuleId,
      occurrenceSequence: source.occurrenceSequence,
      canMutateRecurrenceTruth: false,
      googleCalendarSeriesMode: "NO_RRULE_SERIES",
    },
  };
}

export async function resolveMaterializedRecurrenceCalendarIntent(
  event: ClaimedOutboxEvent,
  source: MaterializedRecurrenceVisitSourcePort,
): Promise<Result<OutboxJob>> {
  if (event.topic !== "recurrence.visit.materialized" && event.topic !== "calendar.visit.upsert") {
    return { ok: false, code: "UNSUPPORTED_RECURRENCE_OUTBOX_TOPIC", message: "Only materialized recurrence visit calendar upsert events are supported." };
  }

  const payload = isRecord(event.payload) ? event.payload : {};
  const payloadRuleId = stringField(payload, "recurrenceRuleId");
  const payloadVisitId = stringField(payload, "visitId");
  const payloadSequence = numberField(payload, "occurrenceSequence");

  const loaded = await source.load(event);
  if (!loaded.ok) return loaded;
  const built = buildMaterializedRecurrenceCalendarJob(event, loaded.value);
  if (!built.ok) return built;

  if (payloadRuleId && payloadRuleId !== built.value.recurrenceRuleId) {
    return { ok: false, code: "RECURRENCE_RULE_MISMATCH", message: "Claimed recurrence rule ID does not match authoritative source." };
  }
  if (payloadVisitId && payloadVisitId !== built.value.projection.visitId) {
    return { ok: false, code: "RECURRENCE_VISIT_MISMATCH", message: "Claimed visit ID does not match materialized visit." };
  }
  if (payloadSequence !== undefined && payloadSequence !== built.value.occurrenceSequence) {
    return { ok: false, code: "RECURRENCE_SEQUENCE_MISMATCH", message: "Claimed occurrence sequence does not match authoritative source." };
  }

  return { ok: true, value: built.value.job };
}

export type RecurrenceRuleProviderCommand = "PAUSE" | "SKIP_NEXT" | "RESUME";

export interface RecurrenceRuleProviderMutationPlan {
  command: RecurrenceRuleProviderCommand;
  shouldMutateProviderEvents: false;
  requiresAuthoritativeVisitCancellation: boolean;
  reason: "RECURRENCE_RULE_IS_CORE_TRUTH";
  notes: string[];
}

export function planRecurrenceRuleProviderMutation(command: RecurrenceRuleProviderCommand): RecurrenceRuleProviderMutationPlan {
  return {
    command,
    shouldMutateProviderEvents: false,
    requiresAuthoritativeVisitCancellation: command === "PAUSE" || command === "SKIP_NEXT",
    reason: "RECURRENCE_RULE_IS_CORE_TRUTH",
    notes: [
      "Connector never deletes or rewrites arbitrary Google Calendar events from recurrence-rule commands.",
      "Only an authoritative ServiceDesk visit cancellation event may dispatch calendar.visit.cancel for a materialized visit.",
    ],
  };
}
