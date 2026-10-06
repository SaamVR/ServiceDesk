import type { Result } from "../../contracts";

export interface PhotoIntakeImageContent {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  bytes: Uint8Array;
}

export interface PhotoIntakeClassificationRequest {
  workspaceId: string;
  requestId: string;
  photoAssetId: string;
  consentStatus: "GRANTED" | "REVOKED";
  processingOptOut: boolean;
  trainingAllowed: false;
  allowedCategoryCodes: string[];
  allowedAddOnCodes: string[];
  image: PhotoIntakeImageContent;
}

export interface PhotoIntakeClassificationOutput {
  categoryCode: string;
  proposedAddOnCode?: string;
  confidenceBasisPoints: number;
  rationale?: string;
  followUpQuestions: string[];
}

export interface PhotoIntakeClassifier {
  classifierRef: string;
  classify(input: PhotoIntakeClassificationRequest): Promise<Result<PhotoIntakeClassificationOutput>>;
}

export interface RedactedPhotoClassificationSummary {
  workspaceId: string;
  requestId: string;
  photoAssetId: string;
  mediaType: PhotoIntakeImageContent["mediaType"];
  byteLength: number;
  trainingAllowed: false;
  categoryCount: number;
  addOnCount: number;
}

const codePattern = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function uniqueCodes(values: string[]): boolean {
  return new Set(values).size === values.length
    && values.every((value) => codePattern.test(value));
}

export function validatePhotoClassificationRequest(
  input: PhotoIntakeClassificationRequest,
): Result<PhotoIntakeClassificationRequest> {
  if (!input.workspaceId || !input.requestId || !input.photoAssetId) {
    return fail("PHOTO_AI_SCOPE_REQUIRED", "Photo classification requires workspace, request and asset scope.");
  }
  if (input.consentStatus !== "GRANTED") {
    return fail("PHOTO_AI_CONSENT_REQUIRED", "Photo classification requires granted processing consent.");
  }
  if (input.processingOptOut) {
    return fail("PHOTO_AI_PROCESSING_OPT_OUT", "Photo processing has been opted out.");
  }
  if (input.trainingAllowed !== false) {
    return fail("PHOTO_AI_TRAINING_FORBIDDEN", "Customer images are not available for model training.");
  }
  if (!input.image.bytes?.byteLength || input.image.bytes.byteLength > 20 * 1024 * 1024) {
    return fail("PHOTO_AI_IMAGE_INVALID", "Photo bytes must be present and within the 20 MiB intake limit.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.image.mediaType)) {
    return fail("PHOTO_AI_IMAGE_TYPE_UNSUPPORTED", "Photo type is not supported.");
  }
  if (!uniqueCodes(input.allowedCategoryCodes) || !uniqueCodes(input.allowedAddOnCodes)) {
    return fail("PHOTO_AI_ALLOWLIST_INVALID", "Photo classification allowlists are malformed.");
  }
  if (input.allowedCategoryCodes.length === 0) {
    return fail("PHOTO_AI_CATEGORY_ALLOWLIST_REQUIRED", "At least one approved category is required.");
  }
  return { ok: true, value: input };
}

export function validatePhotoClassificationOutput(
  input: PhotoIntakeClassificationRequest,
  output: unknown,
): Result<PhotoIntakeClassificationOutput> {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return fail("PHOTO_AI_OUTPUT_INVALID", "Photo classifier output must be a structured object.");
  }
  const row = output as Record<string, unknown>;
  const categoryCode = typeof row.categoryCode === "string" ? row.categoryCode : "";
  const proposedAddOnCode = typeof row.proposedAddOnCode === "string" ? row.proposedAddOnCode : undefined;
  const confidenceBasisPoints = row.confidenceBasisPoints;
  const rationale = typeof row.rationale === "string" ? row.rationale.trim() : undefined;
  const followUpQuestions = Array.isArray(row.followUpQuestions)
    ? row.followUpQuestions
    : [];

  if (!input.allowedCategoryCodes.includes(categoryCode)) {
    return fail("PHOTO_AI_CATEGORY_NOT_ALLOWED", "Photo classifier proposed a category outside the approved catalogue.");
  }
  if (proposedAddOnCode && !input.allowedAddOnCodes.includes(proposedAddOnCode)) {
    return fail("PHOTO_AI_ADDON_NOT_ALLOWED", "Photo classifier proposed an add-on outside the approved catalogue.");
  }
  if (typeof confidenceBasisPoints !== "number"
      || !Number.isInteger(confidenceBasisPoints)
      || confidenceBasisPoints < 0
      || confidenceBasisPoints > 10000) {
    return fail("PHOTO_AI_CONFIDENCE_INVALID", "Photo classifier confidence must be between 0 and 10000 basis points.");
  }
  if (rationale && rationale.length > 500) {
    return fail("PHOTO_AI_RATIONALE_INVALID", "Photo classifier rationale is too long.");
  }
  if (followUpQuestions.length > 5
      || followUpQuestions.some((item) => typeof item !== "string" || item.trim().length === 0 || item.trim().length > 200)) {
    return fail("PHOTO_AI_FOLLOWUP_INVALID", "Photo classifier follow-up questions are malformed.");
  }

  for (const forbidden of [
    "priceMinor",
    "totalMinor",
    "depositMinor",
    "balanceMinor",
    "quoteStatus",
    "paymentStatus",
    "availabilityConfirmed",
    "providerVerified",
  ]) {
    if (forbidden in row) {
      return fail("PHOTO_AI_BUSINESS_TRUTH_FORBIDDEN", "Photo AI cannot author pricing, payment, availability or provider truth.");
    }
  }

  return {
    ok: true,
    value: {
      categoryCode,
      proposedAddOnCode,
      confidenceBasisPoints,
      rationale,
      followUpQuestions: followUpQuestions.map((item) => (item as string).trim()),
    },
  };
}

export function redactedPhotoClassificationSummary(
  input: PhotoIntakeClassificationRequest,
): RedactedPhotoClassificationSummary {
  return {
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    photoAssetId: input.photoAssetId,
    mediaType: input.image.mediaType,
    byteLength: input.image.bytes.byteLength,
    trainingAllowed: false,
    categoryCount: input.allowedCategoryCodes.length,
    addOnCount: input.allowedAddOnCodes.length,
  };
}

export async function classifyRequestPhoto(
  classifier: PhotoIntakeClassifier | undefined,
  input: PhotoIntakeClassificationRequest,
): Promise<Result<PhotoIntakeClassificationOutput>> {
  const validated = validatePhotoClassificationRequest(input);
  if (!validated.ok) return validated;
  if (!classifier) {
    return fail("PHOTO_AI_CONFIGURATION_BLOCKED", "No photo-classification provider is configured.");
  }
  if (!classifier.classifierRef?.trim()) {
    return fail("PHOTO_AI_CONFIGURATION_BLOCKED", "Photo-classification provider reference is missing.");
  }
  const result = await classifier.classify(validated.value);
  if (!result.ok) return result;
  return validatePhotoClassificationOutput(validated.value, result.value);
}
