import { describe, expect, it, vi } from "vitest";
import {
  classifyRequestPhoto,
  redactedPhotoClassificationSummary,
  validatePhotoClassificationOutput,
  validatePhotoClassificationRequest,
  type PhotoIntakeClassificationRequest,
} from "../../src/server/ai/photo-intake";

const input: PhotoIntakeClassificationRequest = {
  workspaceId: "workspace-1",
  requestId: "request-1",
  photoAssetId: "asset-1",
  consentStatus: "GRANTED",
  processingOptOut: false,
  trainingAllowed: false,
  allowedCategoryCodes: ["STANDARD", "DEEP", "MOVE_OUT"],
  allowedAddOnCodes: ["OVEN"],
  image: { mediaType: "image/jpeg", bytes: new Uint8Array([1, 2, 3, 4]) },
};

describe("photo-assisted intake AI boundary", () => {
  it("requires explicit consent and blocks opt-out or training use", () => {
    expect(validatePhotoClassificationRequest({ ...input, consentStatus: "REVOKED" }))
      .toMatchObject({ ok: false, code: "PHOTO_AI_CONSENT_REQUIRED" });
    expect(validatePhotoClassificationRequest({ ...input, processingOptOut: true }))
      .toMatchObject({ ok: false, code: "PHOTO_AI_PROCESSING_OPT_OUT" });
    expect(validatePhotoClassificationRequest({ ...input, trainingAllowed: true } as never))
      .toMatchObject({ ok: false, code: "PHOTO_AI_TRAINING_FORBIDDEN" });
  });

  it("accepts only approved category/add-on codes with explicit confidence", () => {
    expect(validatePhotoClassificationOutput(input, {
      categoryCode: "DEEP",
      proposedAddOnCode: "OVEN",
      confidenceBasisPoints: 8200,
      rationale: "Visible buildup suggests a deeper service may be worth review.",
      followUpQuestions: ["How long since the last deep clean?"],
    })).toMatchObject({
      ok: true,
      value: { categoryCode: "DEEP", proposedAddOnCode: "OVEN", confidenceBasisPoints: 8200 },
    });
    expect(validatePhotoClassificationOutput(input, {
      categoryCode: "UNAPPROVED",
      confidenceBasisPoints: 9000,
      followUpQuestions: [],
    })).toMatchObject({ ok: false, code: "PHOTO_AI_CATEGORY_NOT_ALLOWED" });
  });

  it("rejects model-authored price, payment, availability, quote, or provider truth", () => {
    for (const forbidden of [
      { priceMinor: 1000 },
      { totalMinor: 5000 },
      { paymentStatus: "PAID" },
      { quoteStatus: "ACCEPTED" },
      { availabilityConfirmed: true },
      { providerVerified: true },
    ]) {
      expect(validatePhotoClassificationOutput(input, {
        categoryCode: "STANDARD",
        confidenceBasisPoints: 6000,
        followUpQuestions: [],
        ...forbidden,
      })).toMatchObject({ ok: false, code: "PHOTO_AI_BUSINESS_TRUTH_FORBIDDEN" });
    }
  });

  it("fails closed when no vision classifier is configured", async () => {
    expect(await classifyRequestPhoto(undefined, input))
      .toMatchObject({ ok: false, code: "PHOTO_AI_CONFIGURATION_BLOCKED" });
  });

  it("revalidates configured classifier output before returning it", async () => {
    const classify = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        categoryCode: "DEEP",
        confidenceBasisPoints: 7400,
        followUpQuestions: ["Is this condition typical across the property?"],
      },
    });
    const result = await classifyRequestPhoto({ classifierRef: "vision:test", classify }, input);
    expect(result).toMatchObject({ ok: true, value: { categoryCode: "DEEP", confidenceBasisPoints: 7400 } });
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it("redacts image bytes and never serializes customer image content", () => {
    const summary = redactedPhotoClassificationSummary(input);
    expect(summary).toEqual({
      workspaceId: "workspace-1",
      requestId: "request-1",
      photoAssetId: "asset-1",
      mediaType: "image/jpeg",
      byteLength: 4,
      trainingAllowed: false,
      categoryCount: 3,
      addOnCount: 1,
    });
    expect(JSON.stringify(summary)).not.toContain("[1,2,3,4]");
  });
});
