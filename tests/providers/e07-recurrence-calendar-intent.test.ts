import { describe, expect, test } from "vitest";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";
import type { VisitDTO } from "../../src/contracts";
import { FixtureCalendarAdapter } from "../../src/server/integrations/google-calendar/adapter";
import { planGoogleCalendarExternalEventReview } from "../../src/server/integrations/google-calendar/external-conflict";
import { CalendarVisitCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/calendar-dispatcher";
import { planRecurrenceRuleProviderMutation, resolveMaterializedRecurrenceCalendarIntent } from "../../src/server/integrations/outbox/recurrence-calendar-intent";

const now = "2026-10-04T16:00:00.000Z";
const visit: VisitDTO = {
  id: "visit-1",
  workspaceId: "ws-1",
  requestId: "req-1",
  quoteId: "quote-1",
  crewId: "crew-1",
  status: "CONFIRMED",
  startAt: "2026-10-05T10:00:00.000Z",
  serviceMinutes: 60,
  bufferMinutes: 15,
  version: 7,
};
const event: ClaimedOutboxEvent = {
  id: "outbox-rec-1",
  workspaceId: "ws-1",
  topic: "recurrence.visit.materialized",
  payload: { recurrenceRuleId: "rrule-1", occurrenceSequence: 3, visitId: "visit-1" },
  idempotencyKey: "recurrence:rrule-1:3:visit-1",
  attempt: 1,
  claimedAt: now,
};

const source = {
  eventId: event.id,
  workspaceId: "ws-1",
  recurrenceRuleId: "rrule-1",
  occurrenceSequence: 3,
  visit,
  binding: { workspaceId: "ws-1", crewId: "crew-1", calendarId: "cal-1", status: "CONNECTED" as const, syncToken: "sync", lastSyncedAt: now, stale: false, timezone: "UTC" },
  summary: "Service visit",
  idempotencyKey: "recurrence:rrule-1:3:visit-1",
};

describe("E07 recurrence calendar intent", () => {
  test("projects one materialized VisitDTO without creating a Google RRULE series", async () => {
    const result = await resolveMaterializedRecurrenceCalendarIntent(event, { async load() { return { ok: true, value: source }; } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.channel).toBe("GOOGLE_CALENDAR");
    expect(result.value.purpose).toBe("CALENDAR_VISIT");
    expect(result.value.idempotencyKey).toBe("recurrence:rrule-1:3:visit-1");
    expect(result.value.payload).toMatchObject({ recurrence: { recurrenceRuleId: "rrule-1", occurrenceSequence: 3, canMutateRecurrenceTruth: false, googleCalendarSeriesMode: "NO_RRULE_SERIES" } });
    expect(JSON.stringify(result.value)).not.toContain("RRULE");
  });

  test("dispatches idempotently through existing calendar visit dispatcher", async () => {
    const resolved = await resolveMaterializedRecurrenceCalendarIntent(event, { async load() { return { ok: true, value: source }; } });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const dispatcher = new CalendarVisitCommittedOutboxDispatcher(new FixtureCalendarAdapter(), () => now);
    const first = await dispatcher.dispatch({ job: resolved.value, committedAt: now, attempt: 1, expectedChannel: "GOOGLE_CALENDAR" });
    const second = await dispatcher.dispatch({ job: resolved.value, committedAt: now, attempt: 2, expectedChannel: "GOOGLE_CALENDAR" });
    expect(first.ok && first.value.outcome).toBe("ACCEPTED");
    expect(second.ok && second.value.outcome).toBe("ACCEPTED");
    expect(first.ok && second.ok && first.value.providerMessageId).toBe(second.ok && second.value.providerMessageId);
  });

  test("pause/SKIP_NEXT never directly mutates arbitrary provider events", () => {
    expect(planRecurrenceRuleProviderMutation("PAUSE")).toMatchObject({ shouldMutateProviderEvents: false, requiresAuthoritativeVisitCancellation: true });
    expect(planRecurrenceRuleProviderMutation("SKIP_NEXT")).toMatchObject({ shouldMutateProviderEvents: false, requiresAuthoritativeVisitCancellation: true });
  });

  test("external edit and cancellation remain operator-review only", () => {
    const appVisit = { workspaceId: "ws-1", crewId: "crew-1", visitId: "visit-1", providerEventId: "gcal_fixture_visit-1", startAt: visit.startAt, endAt: "2026-10-05T11:15:00.000Z", summary: "Service visit" };
    expect(planGoogleCalendarExternalEventReview({ appVisit, providerEvent: { id: "gcal_fixture_visit-1", status: "confirmed", startAt: visit.startAt, endAt: "2026-10-05T12:00:00.000Z", summary: "Moved" } })).toMatchObject({ action: "OPERATOR_REVIEW", canMutateBookingTruth: false });
    expect(planGoogleCalendarExternalEventReview({ appVisit, providerEvent: { id: "gcal_fixture_visit-1", status: "cancelled" } })).toMatchObject({ action: "OPERATOR_REVIEW", canMutateBookingTruth: false });
  });
});
