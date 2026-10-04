import { describe, expect, it } from "vitest";
import { sampleAttentionItems, sampleVisit } from "../../src/features/operations/sample-data";
import {
  buildQualityCaseView,
  type QualityCaseFixture,
} from "../../src/features/quality/view-models";

const qualityCase: QualityCaseFixture = {
  id: "quality_sample_001",
  visitId: sampleVisit.id,
  state: "OPEN",
  feedbackScore: 2,
  summary: "Customer reported missed skirting boards.",
  ownerUserId: "dispatcher_1",
  dueAt: "2026-10-05T12:00:00.000Z",
  resolutionNote: undefined,
  reviewRequestState: "NOT_ELIGIBLE",
};

describe("quality case UI model", () => {
  it("keeps owner, deadline and resolution state explicit", () => {
    const view = buildQualityCaseView({
      visit: { ...sampleVisit, status: "PENDING_REVIEW" },
      qualityCase,
      attentionItems: sampleAttentionItems,
    });

    expect(view.ownerLabel).toBe("dispatcher_1");
    expect(view.deadlineLabel).toContain("2026");
    expect(view.resolutionLabel).toBe("Open · resolution required");
  });

  it("does not expose optional review request before resolution", () => {
    const view = buildQualityCaseView({
      visit: { ...sampleVisit, status: "PENDING_REVIEW" },
      qualityCase,
      attentionItems: sampleAttentionItems,
    });

    expect(view.canRequestReview).toBe(false);
    expect(view.reviewRequestLabel).toBe("Resolve quality case before requesting a review");
  });

  it("labels quality data as fixture-only until a shared DTO exists", () => {
    const view = buildQualityCaseView({
      visit: sampleVisit,
      qualityCase,
      attentionItems: sampleAttentionItems,
    });

    expect(view.dataSource).toBe("FIXTURE_UI_ONLY");
  });
});
