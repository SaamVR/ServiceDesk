export interface GoogleCalendarAppVisitProjection {
  workspaceId: string;
  crewId: string;
  visitId: string;
  providerEventId: string;
  startAt: string;
  endAt: string;
  summary: string;
}

export interface GoogleCalendarProviderEventProjection {
  id: string;
  status?: "confirmed" | "cancelled" | string;
  startAt?: string;
  endAt?: string;
  summary?: string;
}

export type GoogleCalendarExternalEventReviewAction = "NOOP" | "OPERATOR_REVIEW";
export type GoogleCalendarExternalEventReviewReason =
  | "MATCHES_APP_VISIT"
  | "PROVIDER_EVENT_MISSING"
  | "PROVIDER_EVENT_CANCELLED"
  | "PROVIDER_EVENT_ID_MISMATCH"
  | "EXTERNAL_EDIT";

export interface GoogleCalendarExternalEventReviewPlan {
  action: GoogleCalendarExternalEventReviewAction;
  reason: GoogleCalendarExternalEventReviewReason;
  blocksInstantConfirm: boolean;
  canMutateBookingTruth: false;
  notes: string[];
}

function review(reason: GoogleCalendarExternalEventReviewReason, notes: string[]): GoogleCalendarExternalEventReviewPlan {
  return {
    action: "OPERATOR_REVIEW",
    reason,
    blocksInstantConfirm: true,
    canMutateBookingTruth: false,
    notes,
  };
}

export function planGoogleCalendarExternalEventReview(input: {
  appVisit: GoogleCalendarAppVisitProjection;
  providerEvent?: GoogleCalendarProviderEventProjection;
}): GoogleCalendarExternalEventReviewPlan {
  if (!input.providerEvent) {
    return review("PROVIDER_EVENT_MISSING", ["Mapped Google Calendar event is missing; operator review is required before trusting provider availability."]);
  }

  if (input.providerEvent.id !== input.appVisit.providerEventId) {
    return review("PROVIDER_EVENT_ID_MISMATCH", ["Provider event ID does not match the app-managed visit mapping; do not rewrite booking truth from this event."]);
  }

  if (input.providerEvent.status === "cancelled") {
    return review("PROVIDER_EVENT_CANCELLED", ["Mapped Google Calendar event was cancelled externally; operator review is required."]);
  }

  const matches = input.providerEvent.startAt === input.appVisit.startAt
    && input.providerEvent.endAt === input.appVisit.endAt
    && input.providerEvent.summary === input.appVisit.summary;

  if (!matches) {
    return review("EXTERNAL_EDIT", ["Provider event differs from ServiceDesk visit projection; route to operator review instead of mutating booking truth."]);
  }

  return {
    action: "NOOP",
    reason: "MATCHES_APP_VISIT",
    blocksInstantConfirm: false,
    canMutateBookingTruth: false,
    notes: ["Google Calendar event still matches ServiceDesk visit projection."],
  };
}
