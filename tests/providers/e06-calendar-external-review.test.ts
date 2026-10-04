import { describe, expect, test } from "vitest";
import { planGoogleCalendarExternalEventReview } from "../../src/server/integrations/google-calendar/external-conflict";
import { classifyGoogleCalendarRecovery } from "../../src/server/integrations/google-calendar/calendar-recovery-policy";

const appVisit = { workspaceId: "ws-1", crewId: "crew-1", visitId: "visit-1", providerEventId: "gcal-visit-1", startAt: "2026-10-05T09:00:00.000Z", endAt: "2026-10-05T11:00:00.000Z", summary: "Visit req-1" };

describe("E06 Calendar external review semantics", () => {
  test("external edits/cancellations route to review and never mutate booking truth", () => {
    expect(planGoogleCalendarExternalEventReview({ appVisit, providerEvent: { id: "gcal-visit-1", status: "confirmed", startAt: "2026-10-05T12:00:00.000Z", endAt: appVisit.endAt, summary: "Changed" } })).toMatchObject({ action: "OPERATOR_REVIEW", reason: "EXTERNAL_EDIT", canMutateBookingTruth: false });
    expect(planGoogleCalendarExternalEventReview({ appVisit, providerEvent: { id: "gcal-visit-1", status: "cancelled", startAt: appVisit.startAt, endAt: appVisit.endAt, summary: appVisit.summary } })).toMatchObject({ action: "OPERATOR_REVIEW", reason: "PROVIDER_EVENT_CANCELLED", canMutateBookingTruth: false });
    expect(planGoogleCalendarExternalEventReview({ appVisit })).toMatchObject({ action: "OPERATOR_REVIEW", reason: "PROVIDER_EVENT_MISSING", canMutateBookingTruth: false });
  });

  test("classifies calendar recovery outcomes", () => {
    expect(classifyGoogleCalendarRecovery("HTTP_503")).toBe("RETRYABLE");
    expect(classifyGoogleCalendarRecovery("CALENDAR_REAUTH_REQUIRED")).toBe("TERMINAL_CONFIG");
    expect(classifyGoogleCalendarRecovery("INVALID_PROVIDER_EVENT_MAPPING")).toBe("OPERATOR_REVIEW");
    expect(classifyGoogleCalendarRecovery("SYNC_TOKEN_EXPIRED")).toBe("FULL_REBUILD_REQUIRED");
  });
});
