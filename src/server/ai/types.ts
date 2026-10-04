import type { ActorContext, Result } from "../../contracts";

export type AiRiskFlag =
  | "MISSING_REQUIRED_FIELDS"
  | "UNSUPPORTED_WORK"
  | "UNSUPPORTED_AREA"
  | "OVERSIZED_PROPERTY"
  | "PROMPT_INJECTION"
  | "CROSS_CUSTOMER_ACCESS"
  | "HUMAN_HANDOVER"
  | "PROVIDER_FAILURE";

export interface CleaningRequestExtraction {
  serviceCode?: "STANDARD" | "DEEP" | "MOVE_OUT";
  bedrooms?: number;
  bathrooms?: number;
  hasOven?: boolean;
  area?: string;
  requestedDateText?: string;
  requestedStartAt?: string;
  customerName?: string;
  propertyKind?: "STUDIO" | "APARTMENT" | "HOUSE" | "OFFICE";
  corrections: string[];
  unsupportedReasons: string[];
  riskFlags: AiRiskFlag[];
}

export interface AssistantToolCall {
  name:
    | "getServiceCatalog"
    | "searchApprovedKnowledge"
    | "validateServiceArea"
    | "updateRequestFields"
    | "calculateQuote"
    | "findAvailableSlots"
    | "createQuoteDraft"
    | "requestHumanReview"
    | "getCustomerBookingSummary"
    | "proposeReschedule"
    | "getBusinessMetrics";
  arguments: Record<string, unknown>;
  allowed: boolean;
  reason: string;
}

export interface KnowledgeCitation {
  documentId: string;
  title: string;
  version: number;
  chunkId: string;
}

export interface AssistantTurn {
  conversationId: string;
  workspaceId: string;
  savedHumanMessageId: string;
  extraction: CleaningRequestExtraction;
  toolCalls: AssistantToolCall[];
  replyDraft: string;
  missingQuestions: string[];
  citations: KnowledgeCitation[];
  handoverRequired: boolean;
  handoverReason?: string;
  model: string;
  promptVersion: string;
  privateReasoningStored: false;
}

export interface AiMessageInput {
  messageId: string;
  channel: "WEB" | "WHATSAPP" | "EMAIL";
  text: string;
  receivedAt: string;
  requestId?: string;
  customerId?: string;
  simulateProviderFailure?: boolean;
  handoverActive?: boolean;
}

export interface AiService {
  respond(ctx: ActorContext, conversationId: string, input: AiMessageInput): Promise<Result<AssistantTurn>>;
}

export interface AiConversationStore {
  appendHumanMessage(input: { conversationId: string; workspaceId: string; messageId: string; text: string; receivedAt: string }): Promise<string>;
}
