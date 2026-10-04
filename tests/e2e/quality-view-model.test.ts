import { describe, expect, it } from "vitest";
import type { QualityCaseDTO } from "../../src/contracts";
import { sampleAttentionItems, sampleVisit } from "../../src/features/operations/sample-data";
import { buildQualityCaseView } from "../../src/features/quality/view-models";

const qualityCase: QualityCaseDTO = {
  id: "quality_sample_001",
  workspaceId: sampleVisit.workspaceId,
  visitId: sampleVisit.id,
  state: "OPEN",
  feedbackScore: 2,
  summary: "Customer reported missed skirting boards.",
  ownerUserId: "dispatcher_1",
  dueAt: "2026-10-05T12:00:00.000Z",
  reviewRequestState: "NOT_ELIGIBLE",
  version: 1,
  createdAt: "2026-10-04T06:00:00.000Z",
  updatedAt: "2026-10-04T06:00:00.000Z",
};

describe("quality case UI model", () => {
  it("keeps owner, deadline and resolution state explicit", () => {
    const view = buildQualityCaseView({ visit: { ...sampleVisit, status: "PENDING_REVIEW" }, qualityCase, attentionItems: sampleAttentionItems, sourceLabel: "SERVER_SNAPSHOT" });
    expect(view.ownerLabel).toBe("dispatcher_1");
    expect(view.deadlineLabel).toContain("2026");
    expect(view.resolutionLabel).toBe("Open · resolution required");
  });

  it("does not expose optional review request before resolution", () => {
    const view = buildQualityCaseView({ visit: { ...sampleVisit, status: "PENDING_REVIEW" }, qualityCase, attentionItems: sampleAttentionItems, sourceLabel: "SERVER_SNAPSHOT" });
    expect(view.canRequestReview).toBe(false);
    expect(view.reviewRequestLabel).toBe("Resolve quality case before requesting a review");
  });

  it("preserves an explicit fixture source label when rendering fixture data", () => {
    const view = buildQualityCaseView({ visit: sampleVisit, qualityCase, attentionItems: sampleAttentionItems, sourceLabel: "FIXTURE_UI_ONLY" });
    expect(view.dataSource).toBe("FIXTURE_UI_ONLY");
  });
});
