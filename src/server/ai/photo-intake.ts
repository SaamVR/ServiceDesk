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
  return Array.isArray(values) && values.length<=80 &&
    new Set(values).size === values.length &&
    values.every(value=>typeof value==="string" && codePattern.test(value));
}
function strictRecord(value:unknown):value is Record<string,unknown> {
  if(!value || typeof value!=="object" || Array.isArray(value) ||
     ![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  return Object.getOwnPropertySymbols(value).length===0 &&
    Object.getOwnPropertyNames(value).length===Object.keys(value).length &&
    Object.values(descriptors).every(d=>Object.hasOwn(d,"value"));
}
function denseArray(value:unknown,max:number):value is unknown[] {
  if(!Array.isArray(value)||value.length>max ||
     Reflect.ownKeys(value).length!==value.length+1)return false;
  for(let i=0;i<value.length;i++){
    const d=Object.getOwnPropertyDescriptor(value,String(i));
    if(!d||!Object.hasOwn(d,"value"))return false;
  }
  return true;
}

export function validatePhotoClassificationRequest(
  input: PhotoIntakeClassificationRequest,
): Result<PhotoIntakeClassificationRequest> {
  if (!input || typeof input.workspaceId!=="string" || !input.workspaceId.trim() ||
      typeof input.requestId!=="string" || !input.requestId.trim() ||
      typeof input.photoAssetId!=="string" || !input.photoAssetId.trim()) {
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
  if (!input.image || !(input.image.bytes instanceof Uint8Array) ||
      !input.image.bytes.byteLength || input.image.bytes.byteLength > 20 * 1024 * 1024) {
    return fail("PHOTO_AI_IMAGE_INVALID", "Photo bytes must be present and within the 20 MiB intake limit.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.image.mediaType)) {
    return fail("PHOTO_AI_IMAGE_TYPE_UNSUPPORTED", "Photo type is not supported.");
  }
  if (!denseArray(input.allowedCategoryCodes,80) ||
      !denseArray(input.allowedAddOnCodes,80) ||
      !uniqueCodes(input.allowedCategoryCodes) || !uniqueCodes(input.allowedAddOnCodes)) {
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
  if (!strictRecord(output)) {
    return fail("PHOTO_AI_OUTPUT_INVALID", "Photo classifier output must be a safe structured object.");
  }
  const row = output as Record<string, unknown>;
  const forbidden = [
    "priceMinor","totalMinor","depositMinor","balanceMinor",
    "quoteStatus","paymentStatus","availabilityConfirmed","providerVerified",
  ];
  if(forbidden.some(key=>Object.hasOwn(row,key)))
    return fail("PHOTO_AI_BUSINESS_TRUTH_FORBIDDEN",
      "Photo AI cannot author pricing, payment, availability or provider truth.");
  const permitted=["categoryCode","proposedAddOnCode","confidenceBasisPoints","rationale","followUpQuestions"];
  if(Object.keys(row).some(key=>!permitted.includes(key)))
    return fail("PHOTO_AI_OUTPUT_INVALID",
      "Photo classifier included unsupported fields or proposed effects.");
  // Optional AI fields are still untrusted content. Never silently coerce
  // objects containing hidden proposals to undefined and accept the rest.
  if ((row.proposedAddOnCode!==undefined && typeof row.proposedAddOnCode!=="string") ||
      (row.rationale!==undefined && typeof row.rationale!=="string")) {
    return fail("PHOTO_AI_OUTPUT_INVALID", "Photo AI optional fields must be plain text.");
  }
  const categoryCode = typeof row.categoryCode === "string" ? row.categoryCode : "";
  const proposedAddOnCode = typeof row.proposedAddOnCode === "string" ? row.proposedAddOnCode : undefined;
  const confidenceBasisPoints = row.confidenceBasisPoints;
  const rationale = typeof row.rationale === "string" ? row.rationale.trim() : undefined;
  if(!denseArray(row.followUpQuestions,5))
    return fail("PHOTO_AI_FOLLOWUP_INVALID", "Photo AI follow-up questions must be a bounded list.");
  const followUpQuestions = row.followUpQuestions as unknown[];

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
  if (rationale && (rationale.length > 500 ||
      /[\u0000-\u001f\u007f\u202a-\u202e\u2060-\u206f]/u.test(rationale))) {
    return fail("PHOTO_AI_RATIONALE_INVALID", "Photo classifier rationale is too long.");
  }
  if (followUpQuestions.length > 5
      || followUpQuestions.some((item) => typeof item !== "string" ||
        item.trim().length === 0 || item.trim().length > 200 ||
        /[\u0000-\u001f\u007f\u202a-\u202e\u2060-\u206f]/u.test(item))) {
    return fail("PHOTO_AI_FOLLOWUP_INVALID", "Photo classifier follow-up questions are malformed.");
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
