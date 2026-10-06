import type { Result } from "../../contracts";
import {
  classifyRequestPhoto,
  type PhotoIntakeClassificationOutput,
  type PhotoIntakeClassificationRequest,
  type PhotoIntakeClassifier,
} from "./photo-intake";

export interface PhotoIntakeExecutionContext {
  request: PhotoIntakeClassificationRequest;
  classifierRef: string;
}

export interface PhotoSuggestionRecordInput extends PhotoIntakeClassificationOutput {
  workspaceId: string;
  requestId: string;
  photoAssetId: string;
  classifierRef: string;
  idempotencyKey: string;
  generatedAt: string;
}

export interface PhotoSuggestionRecord {
  suggestionId: string;
  duplicate: boolean;
}

export interface PhotoIntakeExecutionPort {
  loadContext(input: {
    workspaceId: string;
    requestId: string;
    photoAssetId: string;
    classifierRef: string;
    now: string;
  }): Promise<Result<PhotoIntakeExecutionContext>>;
  recordSuggestion(input: PhotoSuggestionRecordInput): Promise<Result<PhotoSuggestionRecord>>;
}

export type PhotoIntakeExecutionOutcome =
  | {
      state: "SUGGESTION_RECORDED";
      suggestionId: string;
      duplicate: boolean;
    }
  | {
      state: "HUMAN_REVIEW_ONLY";
      reasonCode: string;
    };

export async function executeRequestPhotoClassification(input: {
  classifier?: PhotoIntakeClassifier;
  port: PhotoIntakeExecutionPort;
  workspaceId: string;
  requestId: string;
  photoAssetId: string;
  now: string;
}): Promise<Result<PhotoIntakeExecutionOutcome>> {
  if (!input.classifier) {
    return {
      ok: true,
      value: {
        state: "HUMAN_REVIEW_ONLY",
        reasonCode: "PHOTO_AI_CONFIGURATION_BLOCKED",
      },
    };
  }

  const context = await input.port.loadContext({
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    photoAssetId: input.photoAssetId,
    classifierRef: input.classifier.classifierRef,
    now: input.now,
  });
  if (!context.ok) return context;

  const classified = await classifyRequestPhoto(input.classifier, context.value.request);
  if (!classified.ok) {
    return {
      ok: true,
      value: {
        state: "HUMAN_REVIEW_ONLY",
        reasonCode: classified.code,
      },
    };
  }

  const recorded = await input.port.recordSuggestion({
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    photoAssetId: input.photoAssetId,
    classifierRef: context.value.classifierRef,
    idempotencyKey: [
      "photo-classification",
      input.photoAssetId,
      context.value.classifierRef,
    ].join(":"),
    generatedAt: input.now,
    ...classified.value,
  });
  if (!recorded.ok) return recorded;

  return {
    ok: true,
    value: {
      state: "SUGGESTION_RECORDED",
      suggestionId: recorded.value.suggestionId,
      duplicate: recorded.value.duplicate,
    },
  };
}
