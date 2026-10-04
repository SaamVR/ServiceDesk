import type { Result, VisitDTO } from "../../../contracts";
import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { OutboxJob } from "../types";
import type { CalendarCrewBinding } from "../google-calendar/visit-projection-bridge";
import { buildServiceDeskManagedVisitCalendarProjection, type CalendarVisitProjectionAction, type ServiceDeskManagedVisitCalendarProjection } from "../google-calendar/visit-projection-bridge";

export interface CalendarVisitAuthoritativeSource {
  eventId: string;
  workspaceId: string;
  action: CalendarVisitProjectionAction;
  visit: VisitDTO;
  binding: CalendarCrewBinding;
  summary: string;
  idempotencyKey: string;
  providerEventId?: string;
}

export interface CalendarVisitAuthoritativeSourcePort {
  load(event: ClaimedOutboxEvent): Promise<Result<CalendarVisitAuthoritativeSource>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function expectedAction(topic: string): CalendarVisitProjectionAction | undefined {
  if (topic === "calendar.visit.upsert") return "UPSERT";
  if (topic === "calendar.visit.cancel") return "CANCEL";
  return undefined;
}

export function buildCalendarVisitOutboxJob(event: ClaimedOutboxEvent, projection: ServiceDeskManagedVisitCalendarProjection): OutboxJob {
  return {
    id: event.id,
    workspaceId: projection.workspaceId,
    channel: "GOOGLE_CALENDAR",
    purpose: "CALENDAR_VISIT",
    recipient: {
      recipientRef: `google-calendar:${projection.calendarId}`,
      consentRequired: false,
      hasOptIn: true,
      optedOut: false,
    },
    createdAt: event.claimedAt,
    idempotencyKey: projection.idempotencyKey,
    payload: {
      calendarVisit: {
        action: projection.action,
        workspaceId: projection.workspaceId,
        visitId: projection.visitId,
        requestId: projection.requestId,
        quoteId: projection.quoteId,
        crewId: projection.crewId,
        calendarId: projection.calendarId,
        startAt: projection.startAt,
        endAt: projection.endAt,
        timezone: projection.timezone,
        summary: projection.summary,
        idempotencyKey: projection.idempotencyKey,
        providerMappingKey: projection.providerMappingKey,
        providerEventId: projection.providerEventId,
        visit: projection.visit,
        canMutateBookingTruth: false,
      },
    },
  };
}

export async function resolveCalendarVisitOutboxIntent(
  event: ClaimedOutboxEvent,
  source: CalendarVisitAuthoritativeSourcePort,
): Promise<Result<OutboxJob>> {
  const action = expectedAction(event.topic);
  if (!action) return { ok: false, code: "UNSUPPORTED_CALENDAR_OUTBOX_TOPIC", message: "Only calendar.visit.upsert and calendar.visit.cancel are supported." };

  const payload = isRecord(event.payload) ? event.payload : {};
  const payloadVisitId = stringField(payload, "visitId");
  const payloadCrewId = stringField(payload, "crewId");

  const loaded = await source.load(event);
  if (!loaded.ok) return loaded;
  const auth = loaded.value;
  if (auth.eventId !== event.id || auth.workspaceId !== event.workspaceId || auth.action !== action) {
    return { ok: false, code: "CALENDAR_OUTBOX_IDENTITY_MISMATCH", message: "Authoritative calendar source did not match claimed outbox event identity." };
  }
  if (payloadVisitId && payloadVisitId !== auth.visit.id) {
    return { ok: false, code: "CALENDAR_OUTBOX_VISIT_MISMATCH", message: "Claimed visit ID does not match authoritative visit." };
  }
  if (payloadCrewId && payloadCrewId !== auth.visit.crewId) {
    return { ok: false, code: "CALENDAR_OUTBOX_CREW_MISMATCH", message: "Claimed crew ID does not match authoritative visit crew." };
  }

  const projection = buildServiceDeskManagedVisitCalendarProjection({
    action: auth.action,
    visit: auth.visit,
    binding: auth.binding,
    summary: auth.summary,
    idempotencyKey: auth.idempotencyKey,
    providerEventId: auth.providerEventId,
  });
  if (!projection.ok) return projection;

  return { ok: true, value: buildCalendarVisitOutboxJob(event, projection.value) };
}

export function readCalendarVisitProjection(job: OutboxJob): Result<ServiceDeskManagedVisitCalendarProjection> {
  const root = isRecord(job.payload.calendarVisit) ? job.payload.calendarVisit : undefined;
  if (!root) return { ok: false, code: "CALENDAR_VISIT_PAYLOAD_INVALID", message: "Calendar outbox job must include server-resolved calendarVisit payload." };
  if (job.channel !== "GOOGLE_CALENDAR" || job.purpose !== "CALENDAR_VISIT") {
    return { ok: false, code: "CHANNEL_MISMATCH", message: "Calendar visit projection can only be dispatched through GOOGLE_CALENDAR/CALENDAR_VISIT." };
  }
  if (root.workspaceId !== job.workspaceId || root.idempotencyKey !== job.idempotencyKey) {
    return { ok: false, code: "CALENDAR_VISIT_PAYLOAD_INVALID", message: "Calendar visit payload identity does not match outbox job." };
  }
  const projection = root as unknown as ServiceDeskManagedVisitCalendarProjection;
  if (!projection.visit || projection.canMutateBookingTruth !== false) {
    return { ok: false, code: "CALENDAR_VISIT_PAYLOAD_INVALID", message: "Calendar visit payload must include visit projection and canMutateBookingTruth=false." };
  }
  return { ok: true, value: projection };
}
