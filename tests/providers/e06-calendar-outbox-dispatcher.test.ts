import { describe, expect, test } from "vitest";
import type { CalendarAdapter, RedactedProviderEvidence } from "../../src/server/integrations/types";
import type { Result, VisitDTO } from "../../src/contracts";
import { resolveCalendarVisitOutboxIntent } from "../../src/server/integrations/outbox/calendar-visit-intent";
import { CalendarVisitCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/calendar-dispatcher";
import type { CalendarCrewBinding } from "../../src/server/integrations/google-calendar/visit-projection-bridge";

const now = "2026-10-04T15:40:00.000Z";
const visit: VisitDTO = { id: "visit-1", workspaceId: "ws-1", requestId: "req-1", quoteId: "quote-1", crewId: "crew-1", status: "CONFIRMED", startAt: "2026-10-05T09:00:00.000Z", serviceMinutes: 90, bufferMinutes: 30, version: 3 };
const binding: CalendarCrewBinding = { workspaceId: "ws-1", crewId: "crew-1", calendarId: "cal-1", status: "CONNECTED", syncToken: "sync-1", lastSyncedAt: "2026-10-04T15:35:00.000Z", stale: false, timezone: "Asia/Dhaka" };
const evidence: RedactedProviderEvidence = { provider: "GOOGLE_CALENDAR", mode: "FIXTURE", verification: "CONTRACT_TESTED", capturedAt: now, notes: ["fixture"] };
class Adapter implements CalendarAdapter { calls: string[] = []; async createOrUpdate(v: VisitDTO): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>> { this.calls.push(`upsert:${v.id}`); return { ok: true, value: { providerEventId: `gcal-${v.id}`, evidence } }; } async cancel(v: VisitDTO): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>> { this.calls.push(`cancel:${v.id}`); return { ok: true, value: { providerEventId: `gcal-${v.id}`, evidence } }; } async listBusy() { return { ok: true as const, value: [] }; } async recoverSync(state: any) { return { ok: true as const, value: state }; } }

describe("E06 Calendar outbox dispatcher", () => {
  test("dispatches calendar.visit.upsert through injected adapter and preserves idempotency", async () => {
    const event = { id: "outbox-1", workspaceId: "ws-1", topic: "calendar.visit.upsert", payload: { visitId: "visit-1", crewId: "crew-1" }, idempotencyKey: "idem-1", attempt: 1, claimedAt: now };
    const intent = await resolveCalendarVisitOutboxIntent(event, { async load() { return { ok: true, value: { eventId: "outbox-1", workspaceId: "ws-1", action: "UPSERT", visit, binding, summary: "Visit req-1", idempotencyKey: "idem-1" } }; } });
    expect(intent.ok).toBe(true);
    if (!intent.ok) return;
    const adapter = new Adapter();
    const sent = await new CalendarVisitCommittedOutboxDispatcher(adapter, () => now).dispatch({ job: intent.value, committedAt: now, attempt: 1, expectedChannel: "GOOGLE_CALENDAR" });
    expect(sent).toMatchObject({ ok: true, value: { outcome: "ACCEPTED", providerMessageId: "gcal-visit-1", idempotencyKey: "idem-1" } });
    expect(adapter.calls).toEqual(["upsert:visit-1"]);
  });

  test("provider failure is retryable and does not mutate VisitDTO", async () => {
    const before = JSON.stringify(visit);
    const job = (await resolveCalendarVisitOutboxIntent({ id: "outbox-1", workspaceId: "ws-1", topic: "calendar.visit.upsert", payload: {}, idempotencyKey: "idem-1", attempt: 1, claimedAt: now }, { async load() { return { ok: true, value: { eventId: "outbox-1", workspaceId: "ws-1", action: "UPSERT", visit, binding, summary: "Visit req-1", idempotencyKey: "idem-1" } }; } })) as any;
    const failing: CalendarAdapter = { async createOrUpdate() { return { ok: false, code: "NETWORK_ERROR", message: "Bearer token raw payload customer@example.com +15551234567" }; }, async cancel() { return { ok: false, code: "NETWORK_ERROR", message: "network" }; }, async listBusy() { return { ok: true, value: [] }; }, async recoverSync(s: any) { return { ok: true, value: s }; } };
    const failed = await new CalendarVisitCommittedOutboxDispatcher(failing, () => now).dispatch({ job: job.value, committedAt: now, attempt: 1, expectedChannel: "GOOGLE_CALENDAR" });
    expect(failed).toMatchObject({ ok: true, value: { outcome: "RETRYABLE_FAILURE", code: "NETWORK_ERROR" } });
    expect(JSON.stringify(visit)).toBe(before);
    expect(JSON.stringify(failed)).not.toContain("token");
    expect(JSON.stringify(failed)).not.toContain("customer@example.com");
  });
});
