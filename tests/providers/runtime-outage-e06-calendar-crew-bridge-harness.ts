import assert from "node:assert/strict";
import type { Result, VisitDTO } from "../../src/contracts";
import type { CalendarAdapter, RedactedProviderEvidence } from "../../src/server/integrations/types";
import type { CalendarCrewBinding } from "../../src/server/integrations/google-calendar/visit-projection-bridge";
import { buildServiceDeskManagedVisitCalendarProjection, resolveAuthoritativeCalendarCrewBinding } from "../../src/server/integrations/google-calendar/visit-projection-bridge";
import { planGoogleCalendarExternalEventReview } from "../../src/server/integrations/google-calendar/external-conflict";
import { resolveCalendarVisitOutboxIntent } from "../../src/server/integrations/outbox/calendar-visit-intent";
import { CalendarVisitCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/calendar-dispatcher";
import { classifyGoogleCalendarRecovery } from "../../src/server/integrations/google-calendar/calendar-recovery-policy";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";

const now = "2026-10-04T15:40:00.000Z";
const visit: VisitDTO = {
  id: "visit-1",
  workspaceId: "ws-1",
  requestId: "req-1",
  quoteId: "quote-1",
  crewId: "crew-1",
  status: "CONFIRMED",
  startAt: "2026-10-05T09:00:00.000Z",
  serviceMinutes: 90,
  bufferMinutes: 30,
  version: 7,
};
const binding: CalendarCrewBinding = {
  workspaceId: "ws-1",
  crewId: "crew-1",
  calendarId: "cal-crew-1",
  status: "CONNECTED",
  syncToken: "sync-1",
  lastSyncedAt: "2026-10-04T15:35:00.000Z",
  stale: false,
  timezone: "Asia/Dhaka",
};
function event(topic = "calendar.visit.upsert", id = "outbox-1"): ClaimedOutboxEvent {
  return { id, workspaceId: "ws-1", topic, payload: { visitId: "visit-1", crewId: "crew-1" }, idempotencyKey: `idem-${id}`, attempt: 1, claimedAt: now };
}
function evidence(id: string): RedactedProviderEvidence {
  return { provider: "GOOGLE_CALENDAR", mode: "FIXTURE", verification: "CONTRACT_TESTED", capturedAt: now, controlledId: id, notes: ["fixture calendar write"] };
}
class FixtureCalendar implements CalendarAdapter {
  calls: Array<{ action: string; visit: VisitDTO }> = [];
  fail?: { code: string; message: string };
  async createOrUpdate(v: VisitDTO): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>> {
    this.calls.push({ action: "UPSERT", visit: { ...v } });
    if (this.fail) return { ok: false, code: this.fail.code, message: this.fail.message };
    return { ok: true, value: { providerEventId: `gcal-${v.id}`, evidence: evidence(`gcal-${v.id}`) } };
  }
  async cancel(v: VisitDTO): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>> {
    this.calls.push({ action: "CANCEL", visit: { ...v } });
    if (this.fail) return { ok: false, code: this.fail.code, message: this.fail.message };
    return { ok: true, value: { providerEventId: `gcal-${v.id}`, evidence: evidence(`gcal-${v.id}`) } };
  }
  async listBusy() { return { ok: true as const, value: [] }; }
  async recoverSync(state: any) { return { ok: true as const, value: state }; }
}
async function run() {
  const resolved = await resolveAuthoritativeCalendarCrewBinding({ async resolve() { return { ok: true, value: binding }; } }, { workspaceId: "ws-1", crewId: "crew-1", now });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.value.freshness.canInstantConfirm, true);

  const projection = buildServiceDeskManagedVisitCalendarProjection({ action: "UPSERT", visit, binding, summary: "Cleaning visit req-1", idempotencyKey: "idem-outbox-1" });
  assert.equal(projection.ok, true);
  assert.equal(projection.value.endAt, "2026-10-05T11:00:00.000Z");
  assert.equal(projection.value.timezone, "Asia/Dhaka");
  assert.equal(projection.value.canMutateBookingTruth, false);

  const wrongWorkspace = buildServiceDeskManagedVisitCalendarProjection({ action: "UPSERT", visit: { ...visit, workspaceId: "other" }, binding, summary: "x", idempotencyKey: "idem" });
  assert.equal(wrongWorkspace.ok, false);

  const missing = await resolveAuthoritativeCalendarCrewBinding({ async resolve() { return { ok: false, code: "CALENDAR_BINDING_MISSING", message: "none" }; } }, { workspaceId: "ws-1", crewId: "crew-1", now });
  assert.equal(missing.ok, false);

  const stale = await resolveAuthoritativeCalendarCrewBinding({ async resolve() { return { ok: true, value: { ...binding, stale: true } }; } }, { workspaceId: "ws-1", crewId: "crew-1", now });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "CALENDAR_SYNC_STALE");

  const intent = await resolveCalendarVisitOutboxIntent(event(), { async load(e) { return { ok: true, value: { eventId: e.id, workspaceId: e.workspaceId, action: "UPSERT", visit, binding, summary: "Cleaning visit req-1", idempotencyKey: e.idempotencyKey } }; } });
  assert.equal(intent.ok, true);
  assert.equal(intent.value.channel, "GOOGLE_CALENDAR");
  assert.equal(intent.value.purpose, "CALENDAR_VISIT");
  assert.equal((intent.value.payload.calendarVisit as any).providerMappingKey, "google-calendar:ws-1:crew-1:visit-1");

  const dispatcher = new CalendarVisitCommittedOutboxDispatcher(new FixtureCalendar(), () => now);
  const sent = await dispatcher.dispatch({ job: intent.value, committedAt: now, attempt: 1, expectedChannel: "GOOGLE_CALENDAR" });
  assert.equal(sent.ok, true);
  assert.equal(sent.value.outcome, "ACCEPTED");
  assert.equal(sent.value.providerMessageId, "gcal-visit-1");
  assert.equal(sent.value.evidence.notes.join(" ").includes("mapping/evidence only"), true);

  const cancelIntent = await resolveCalendarVisitOutboxIntent(event("calendar.visit.cancel", "outbox-cancel"), { async load(e) { return { ok: true, value: { eventId: e.id, workspaceId: e.workspaceId, action: "CANCEL", visit, binding, summary: "Cleaning visit req-1", idempotencyKey: e.idempotencyKey, providerEventId: "gcal-visit-1" } }; } });
  assert.equal(cancelIntent.ok, true);
  const cancelAdapter = new FixtureCalendar();
  const cancelled = await new CalendarVisitCommittedOutboxDispatcher(cancelAdapter, () => now).dispatch({ job: cancelIntent.value, committedAt: now, attempt: 1, expectedChannel: "GOOGLE_CALENDAR" });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelAdapter.calls[0].action, "CANCEL");

  const externalEdit = planGoogleCalendarExternalEventReview({ appVisit: { workspaceId: "ws-1", crewId: "crew-1", visitId: "visit-1", providerEventId: "gcal-visit-1", startAt: visit.startAt, endAt: projection.value.endAt, summary: "Cleaning visit req-1" }, providerEvent: { id: "gcal-visit-1", status: "confirmed", startAt: "2026-10-05T12:00:00.000Z", endAt: projection.value.endAt, summary: "Changed" } });
  assert.equal(externalEdit.action, "OPERATOR_REVIEW");
  assert.equal(externalEdit.canMutateBookingTruth, false);
  const externalCancel = planGoogleCalendarExternalEventReview({ appVisit: { workspaceId: "ws-1", crewId: "crew-1", visitId: "visit-1", providerEventId: "gcal-visit-1", startAt: visit.startAt, endAt: projection.value.endAt, summary: "Cleaning visit req-1" }, providerEvent: { id: "gcal-visit-1", status: "cancelled", startAt: visit.startAt, endAt: projection.value.endAt, summary: "Cleaning visit req-1" } });
  assert.equal(externalCancel.reason, "PROVIDER_EVENT_CANCELLED");

  const failingAdapter = new FixtureCalendar();
  failingAdapter.fail = { code: "NETWORK_ERROR", message: "Bearer secret-token raw payload customer@example.com +15551234567" };
  const before = JSON.stringify(visit);
  const failed = await new CalendarVisitCommittedOutboxDispatcher(failingAdapter, () => now).dispatch({ job: intent.value, committedAt: now, attempt: 1, expectedChannel: "GOOGLE_CALENDAR" });
  assert.equal(failed.ok, true);
  assert.equal(failed.value.outcome, "RETRYABLE_FAILURE");
  assert.equal(JSON.stringify(visit), before);
  const serializedFailure = JSON.stringify(failed.value);
  assert.equal(serializedFailure.includes("secret-token"), false);
  assert.equal(serializedFailure.includes("customer@example.com"), false);
  assert.equal(serializedFailure.includes("+15551234567"), false);

  const second = await dispatcher.dispatch({ job: intent.value, committedAt: now, attempt: 2, expectedChannel: "GOOGLE_CALENDAR" });
  assert.equal(second.ok, true);
  assert.equal(second.value.idempotencyKey, intent.value.idempotencyKey);
  assert.equal(second.value.providerMessageId, sent.value.providerMessageId);

  assert.equal(classifyGoogleCalendarRecovery("CALENDAR_REAUTH_REQUIRED"), "TERMINAL_CONFIG");
  assert.equal(classifyGoogleCalendarRecovery("HTTP_503"), "RETRYABLE");
  assert.equal(classifyGoogleCalendarRecovery("INVALID_PROVIDER_EVENT_MAPPING"), "OPERATOR_REVIEW");
  assert.equal(classifyGoogleCalendarRecovery("SYNC_TOKEN_EXPIRED"), "FULL_REBUILD_REQUIRED");

  console.log("runtime-outage-e06-calendar-crew-bridge-harness PASS");
}
void run();
