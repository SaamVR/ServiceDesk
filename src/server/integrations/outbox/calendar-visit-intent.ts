import type { Result, VisitDTO } from "../../../contracts";
import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { OutboxJob } from "../types";
import type { CalendarCrewBinding } from "../google-calendar/visit-projection-bridge";
import { buildServiceDeskManagedVisitCalendarProjection, calendarProviderMappingKey, type CalendarVisitProjectionAction, type ServiceDeskManagedVisitCalendarProjection } from "../google-calendar/visit-projection-bridge";

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

function stringField(source: Record<string, unknown>, key: string): string | null | undefined {
  // Missing is optional, but a present malformed claim cannot be ignored as
  // absent before calendar dispatch. Never coerce untrusted provider data.
  if (!Object.hasOwn(source,key)) return undefined;
  const value = source[key];
  return typeof value === "string" && value.length > 0 && value.length <= 256 &&
    value.trim() === value && !/[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(value)
      ? value : null;
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

  if (!isRecord(event.payload)) {
    return { ok: false, code: "CALENDAR_OUTBOX_PAYLOAD_INVALID", message: "Calendar claim payload must be a stored object." };
  }
  const payload = event.payload;
  const payloadVisitId = stringField(payload, "visitId");
  const payloadCrewId = stringField(payload, "crewId");
  if (payloadVisitId === null || payloadCrewId === null) {
    return { ok: false, code: "CALENDAR_OUTBOX_CLAIM_INVALID", message: "Calendar claimed visit/crew ID is malformed." };
  }

  const loaded = await source.load(event);
  if (!loaded.ok) return loaded;
  const auth = loaded.value;
  if (auth.eventId !== event.id || auth.workspaceId !== event.workspaceId ||
      auth.action !== action || auth.idempotencyKey !== event.idempotencyKey) {
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
  const root = isRecord(job?.payload) && isRecord(job.payload.calendarVisit)
    ? job.payload.calendarVisit : undefined;
  if (!root) return { ok: false, code: "CALENDAR_VISIT_PAYLOAD_INVALID", message: "Calendar outbox job must include server-resolved calendarVisit payload." };
  if (job.channel !== "GOOGLE_CALENDAR" || job.purpose !== "CALENDAR_VISIT") {
    return { ok: false, code: "CHANNEL_MISMATCH", message: "Calendar visit projection can only be dispatched through GOOGLE_CALENDAR/CALENDAR_VISIT." };
  }
  if (root.workspaceId !== job.workspaceId || root.idempotencyKey !== job.idempotencyKey) {
    return { ok: false, code: "CALENDAR_VISIT_PAYLOAD_INVALID", message: "Calendar visit payload identity does not match outbox job." };
  }
  // Stored or recovered projections can be corrupted independently of the
  // original claim. Compare the actual VisitDTO dispatched to the provider,
  // not only the duplicated top-level labels.
  const visit = isRecord(root.visit) ? root.visit : null;
  if (!visit || root.canMutateBookingTruth !== false ||
      visit.id !== root.visitId || visit.workspaceId !== root.workspaceId ||
      visit.crewId !== root.crewId || visit.requestId !== root.requestId ||
      visit.quoteId !== root.quoteId || visit.startAt !== root.startAt ||
      (root.action !== "UPSERT" && root.action !== "CANCEL") ||
      root.providerMappingKey !== calendarProviderMappingKey({
        workspaceId: root.workspaceId as string,
        crewId: root.crewId as string,
        visitId: root.visitId as string,
      })) {
    return { ok: false, code: "CALENDAR_VISIT_PAYLOAD_INVALID", message: "Calendar visit payload contradicts authoritative visit identity." };
  }
  const projection = root as unknown as ServiceDeskManagedVisitCalendarProjection;
  return { ok: true, value: projection };
}
