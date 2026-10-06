import { describe, expect, it, vi } from "vitest";
import {
  executeRequestPhotoClassification,
  type PhotoIntakeExecutionPort,
} from "../../src/server/ai/photo-intake-execution";

const context = {
  classifierRef: "vision:controlled",
  request: {
    workspaceId: "workspace-1",
    requestId: "request-1",
    photoAssetId: "asset-1",
    consentStatus: "GRANTED" as const,
    processingOptOut: false,
    trainingAllowed: false as const,
    allowedCategoryCodes: ["STANDARD", "DEEP"],
    allowedAddOnCodes: [],
    image: { mediaType: "image/jpeg" as const, bytes: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 6, 7, 8, 9]) },
  },
};

function port(overrides: Partial<PhotoIntakeExecutionPort> = {}): PhotoIntakeExecutionPort {
  return {
    loadContext: vi.fn().mockResolvedValue({ ok: true, value: context }),
    recordSuggestion: vi.fn().mockResolvedValue({ ok: true, value: { suggestionId: "suggestion-1", duplicate: false } }),
    ...overrides,
  };
}

describe("photo classification execution", () => {
  it("falls back to human review without loading customer image bytes when no provider is configured", async () => {
    const p = port();
    expect(await executeRequestPhotoClassification({
      classifier: undefined,
      port: p,
      workspaceId: "workspace-1",
      requestId: "request-1",
      photoAssetId: "asset-1",
      now: "2026-10-07T00:00:00.000Z",
    })).toEqual({
      ok: true,
      value: { state: "HUMAN_REVIEW_ONLY", reasonCode: "PHOTO_AI_CONFIGURATION_BLOCKED" },
    });
    expect(p.loadContext).not.toHaveBeenCalled();
    expect(p.recordSuggestion).not.toHaveBeenCalled();
  });

  it("records only validated advisory output", async () => {
    const p = port();
    const classifier = {
      classifierRef: "vision:controlled",
      classify: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          categoryCode: "DEEP",
          confidenceBasisPoints: 8100,
          rationale: "Visible condition may warrant deeper review.",
          followUpQuestions: ["Is this condition present throughout the property?"],
        },
      }),
    };
    const result = await executeRequestPhotoClassification({
      classifier,
      port: p,
      workspaceId: "workspace-1",
      requestId: "request-1",
      photoAssetId: "asset-1",
      now: "2026-10-07T00:00:00.000Z",
    });
    expect(result).toEqual({
      ok: true,
      value: { state: "SUGGESTION_RECORDED", suggestionId: "suggestion-1", duplicate: false },
    });
    expect(p.recordSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      categoryCode: "DEEP",
      confidenceBasisPoints: 8100,
      idempotencyKey: "photo-classification:asset-1:vision:controlled",
    }));
  });

  it("routes unsafe or malformed classifier output to human review without recording it", async () => {
    const p = port();
    const classifier = {
      classifierRef: "vision:controlled",
      classify: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          categoryCode: "DEEP",
          confidenceBasisPoints: 8100,
          followUpQuestions: [],
          totalMinor: 50000,
        },
      }),
    };
    expect(await executeRequestPhotoClassification({
      classifier: classifier as never,
      port: p,
      workspaceId: "workspace-1",
      requestId: "request-1",
      photoAssetId: "asset-1",
      now: "2026-10-07T00:00:00.000Z",
    })).toMatchObject({
      ok: true,
      value: { state: "HUMAN_REVIEW_ONLY", reasonCode: "PHOTO_AI_BUSINESS_TRUTH_FORBIDDEN" },
    });
    expect(p.recordSuggestion).not.toHaveBeenCalled();
  });

  it("propagates authoritative asset/context failures", async () => {
    const p = port({
      loadContext: vi.fn().mockResolvedValue({
        ok: false,
        code: "PHOTO_PROCESSING_NOT_ALLOWED",
        message: "Photo asset is not eligible for AI processing.",
      }),
    });
    const classifier = {
      classifierRef: "vision:controlled",
      classify: vi.fn(),
    };
    expect(await executeRequestPhotoClassification({
      classifier,
      port: p,
      workspaceId: "workspace-1",
      requestId: "request-1",
      photoAssetId: "asset-1",
      now: "2026-10-07T00:00:00.000Z",
    })).toMatchObject({ ok: false, code: "PHOTO_PROCESSING_NOT_ALLOWED" });
  });
});
