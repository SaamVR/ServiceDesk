export type RequestPhotoAssetSource = "CUSTOMER_UPLOAD" | "WHATSAPP_MEDIA_REFERENCE";
export type RequestPhotoAssetState = "AVAILABLE" | "RETIRED" | "DELETED";
export type RequestPhotoSuggestionState = "PENDING_REVIEW" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export interface RequestPhotoAssetDTO {
  id: string;
  workspaceId: string;
  requestId: string;
  source: RequestPhotoAssetSource;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  consentStatus: "GRANTED" | "REVOKED";
  consentSource: string;
  consentRecordedAt: string;
  processingOptOut: boolean;
  trainingAllowed: false;
  retentionUntil: string;
  state: RequestPhotoAssetState;
  version: number;
  createdAt: string;
}

export interface RequestPhotoSuggestionDTO {
  id: string;
  workspaceId: string;
  requestId: string;
  photoAssetId: string;
  classifierRef: string;
  categoryCode: string;
  proposedAddOnCode?: string;
  confidenceBasisPoints: number;
  rationale?: string;
  followUpQuestions: string[];
  state: RequestPhotoSuggestionState;
  reviewedBy?: string;
  reviewedAt?: string;
  version: number;
  generatedAt: string;
}

export interface RequestPhotoReviewResultDTO {
  suggestionId: string;
  requestId: string;
  state: "ACCEPTED" | "REJECTED";
  version: number;
  quoteRevisionRequired: boolean;
  acceptedQuoteId?: string;
}
