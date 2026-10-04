import { describe, expect, test } from "vitest";
import { buildServiceDeskManagedVisitCalendarProjection, resolveAuthoritativeCalendarCrewBinding, type CalendarCrewBinding } from "../../src/server/integrations/google-calendar/visit-projection-bridge";
import type { VisitDTO } from "../../src/contracts";

const now = "2026-10-04T15:40:00.000Z";
const visit: VisitDTO = { id: "visit-1", workspaceId: "ws-1", requestId: "req-1", quoteId: "quote-1", crewId: "crew-1", status: "CONFIRMED", startAt: "2026-10-05T09:00:00.000Z", serviceMinutes: 90, bufferMinutes: 30, version: 3 };
const binding: CalendarCrewBinding = { workspaceId: "ws-1", crewId: "crew-1", calendarId: "cal-1", status: "CONNECTED", syncToken: "sync-1", lastSyncedAt: "2026-10-04T15:35:00.000Z", stale: false, timezone: "Asia/Dhaka" };

describe("E06 Calendar visit projection", () => {
  test("builds a ServiceDesk-authoritative visit projection", () => {
    const result = buildServiceDeskManagedVisitCalendarProjection({ action: "UPSERT", visit, binding, summary: "Visit req-1", idempotencyKey: "idem-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ workspaceId: "ws-1", visitId: "visit-1", crewId: "crew-1", calendarId: "cal-1", timezone: "Asia/Dhaka", idempotencyKey: "idem-1", canMutateBookingTruth: false });
    expect(result.value.endAt).toBe("2026-10-05T11:00:00.000Z");
  });

  test("fails closed on wrong workspace and stale calendar state", async () => {
    const mismatch = buildServiceDeskManagedVisitCalendarProjection({ action: "UPSERT", visit: { ...visit, workspaceId: "other" }, binding, summary: "x", idempotencyKey: "idem" });
    expect(mismatch.ok).toBe(false);
    const stale = await resolveAuthoritativeCalendarCrewBinding({ async resolve() { return { ok: true, value: { ...binding, stale: true } }; } }, { workspaceId: "ws-1", crewId: "crew-1", now });
    expect(stale).toMatchObject({ ok: false, code: "CALENDAR_SYNC_STALE" });
  });
});
