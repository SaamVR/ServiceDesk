import type { AttentionItemDTO, VisitDTO } from "@/contracts";

export type QualityCaseState = "OPEN" | "IN_REVIEW" | "RESOLVED";
export type ReviewRequestState = "NOT_ELIGIBLE" | "ELIGIBLE" | "REQUESTED";

export interface QualityCaseFixture {
  id: string;
  visitId: string;
  state: QualityCaseState;
  feedbackScore?: number;
  summary: string;
  ownerUserId?: string;
  dueAt?: string;
  resolutionNote?: string;
  reviewRequestState: ReviewRequestState;
}

export interface QualityCaseView {
  caseId: string;
  visitId: string;
  visitStatus: VisitDTO["status"];
  feedbackLabel: string;
  issueSummary: string;
  ownerLabel: string;
  deadlineLabel: string;
  resolutionLabel: string;
  canRequestReview: boolean;
  reviewRequestLabel: string;
  relatedAttentionCount: number;
  dataSource: "FIXTURE_UI_ONLY";
}

function reviewRequestLabel(
  state: ReviewRequestState,
  qualityState: QualityCaseState,
): string {
  if (qualityState !== "RESOLVED") {
    return "Resolve quality case before requesting a review";
  }

  switch (state) {
    case "REQUESTED":
      return "Review request queued in fixture UI";
    case "ELIGIBLE":
      return "Optional review request available";
    case "NOT_ELIGIBLE":
      return "Review request not eligible";
  }
}

export function buildQualityCaseView({
  visit,
  qualityCase,
  attentionItems,
}: {
  visit: VisitDTO;
  qualityCase: QualityCaseFixture;
  attentionItems: readonly AttentionItemDTO[];
}): QualityCaseView {
  const relatedAttentionCount = attentionItems.filter(
    (item) =>
      item.resourceId === qualityCase.id ||
      item.resourceId === qualityCase.visitId,
  ).length;

  const resolutionLabel =
    qualityCase.state === "RESOLVED"
      ? qualityCase.resolutionNote
        ? `Resolved · ${qualityCase.resolutionNote}`
        : "Resolved"
      : qualityCase.state === "IN_REVIEW"
        ? "In review · owner action required"
        : "Open · resolution required";

  return {
    caseId: qualityCase.id,
    visitId: qualityCase.visitId,
    visitStatus: visit.status,
    feedbackLabel:
      typeof qualityCase.feedbackScore === "number"
        ? `${qualityCase.feedbackScore}/5 customer feedback`
        : "Feedback not recorded",
    issueSummary: qualityCase.summary,
    ownerLabel: qualityCase.ownerUserId ?? "Unassigned",
    deadlineLabel: qualityCase.dueAt
      ? new Date(qualityCase.dueAt).toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        })
      : "No deadline",
    resolutionLabel,
    canRequestReview:
      qualityCase.state === "RESOLVED" &&
      qualityCase.reviewRequestState === "ELIGIBLE",
    reviewRequestLabel: reviewRequestLabel(
      qualityCase.reviewRequestState,
      qualityCase.state,
    ),
    relatedAttentionCount,
    dataSource: "FIXTURE_UI_ONLY",
  };
}
