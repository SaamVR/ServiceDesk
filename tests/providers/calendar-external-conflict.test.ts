import { describe, expect, test } from "vitest";
import { planGoogleCalendarExternalEventReview } from "../../src/server/integrations/google-calendar/external-conflict";

const appVisit = {
  workspaceId: "ws-clearnest",
  crewId: "crew-1",
  visitId: "visit-1",
  providerEventId: "gcal-event-1",
  startAt: "2026-10-05T10:00:00.000Z",
  endAt: "2026-10-05T12:30:00.000Z",
  summary: "ServiceDesk visit",
};

describe("Google Calendar external event conflict review", () => {
  test("allows no-op when app-managed event matches the visit projection", () => {
    expect(planGoogleCalendarExternalEventReview({
      appVisit,
      providerEvent: { id: "gcal-event-1", status: "confirmed", startAt: appVisit.startAt, endAt: appVisit.endAt, summary: appVisit.summary },
    })).toEqual({
      action: "NOOP",
      reason: "MATCHES_APP_VISIT",
      blocksInstantConfirm: false,
      canMutateBookingTruth: false,
      notes: ["Google Calendar event still matches ServiceDesk visit projection."],
    });
  });

  test("routes external edits to operator review without mutating booking truth", () => {
    const result = planGoogleCalendarExternalEventReview({
      appVisit,
      providerEvent: { id: "gcal-event-1", status: "confirmed", startAt: "2026-10-05T10:30:00.000Z", endAt: appVisit.endAt, summary: "Moved externally" },
    });

    expect(result).toMatchObject({ action: "OPERATOR_REVIEW", reason: "EXTERNAL_EDIT", blocksInstantConfirm: true, canMutateBookingTruth: false });
    expect(result.notes.join(" ")).toContain("Provider event differs");
  });

  test("routes missing/deleted provider event to operator review", () => {
    expect(planGoogleCalendarExternalEventReview({ appVisit })).toMatchObject({ action: "OPERATOR_REVIEW", reason: "PROVIDER_EVENT_MISSING", blocksInstantConfirm: true, canMutateBookingTruth: false });
    expect(planGoogleCalendarExternalEventReview({ appVisit, providerEvent: { id: "gcal-event-1", status: "cancelled", startAt: appVisit.startAt, endAt: appVisit.endAt, summary: appVisit.summary } })).toMatchObject({ action: "OPERATOR_REVIEW", reason: "PROVIDER_EVENT_CANCELLED", blocksInstantConfirm: true, canMutateBookingTruth: false });
  });

  test("ignores unrelated provider events rather than rewriting the visit", () => {
    expect(planGoogleCalendarExternalEventReview({
      appVisit,
      providerEvent: { id: "different-event", status: "confirmed", startAt: appVisit.startAt, endAt: appVisit.endAt, summary: appVisit.summary },
    })).toMatchObject({ action: "OPERATOR_REVIEW", reason: "PROVIDER_EVENT_ID_MISMATCH", canMutateBookingTruth: false });
  });
});
