import type { AssistantToolCall } from "./types";

export type AiToolOrchestrationRejectReason =
  | "TOOL_BUDGET_EXCEEDED"
  | "BUSINESS_TRUTH_TOOL_BLOCKED"
  | "UNKNOWN_TOOL"
  | "RESOURCE_OUT_OF_SCOPE"
  | "HANDOVER_ACTIVE"
  | "SCHEMA_VIOLATION";

export type AiToolExecutionBoundary = "SERVICE_DESK_FACADE_ONLY";

export interface AiToolScope {
  workspaceId: string;
  allowedRequestIds?: string[];
  allowedCustomerIds?: string[];
  handoverActive?: boolean;
}

export interface RawAiToolCall {
  name?: unknown;
  arguments?: unknown;
}

export interface AcceptedAiToolCall extends AssistantToolCall {
  executionBoundary: AiToolExecutionBoundary;
  canMutateBusinessTruth: false;
}

export interface RejectedAiToolCall {
  name: string;
  reason: AiToolOrchestrationRejectReason;
  canMutateBusinessTruth: false;
}

export interface AiToolOrchestrationPlan {
  accepted: AcceptedAiToolCall[];
  rejected: RejectedAiToolCall[];
  requiresHumanReview: boolean;
  businessMutationAllowed: false;
  privateReasoningStored: false;
}

const allowedTools = new Set<AssistantToolCall["name"]>([
  "getServiceCatalog",
  "searchApprovedKnowledge",
  "validateServiceArea",
  "updateRequestFields",
  "calculateQuote",
  "findAvailableSlots",
  "createQuoteDraft",
  "requestHumanReview",
  "getCustomerBookingSummary",
  "proposeReschedule",
  "getBusinessMetrics",
]);

const blockedBusinessTruthTools = new Set([
  "markPaymentPaid",
  "applyVerifiedPayment",
  "setPrice",
  "overrideQuote",
  "confirmAvailability",
  "assignCrew",
  "writeDatabase",
  "sendProviderMessage",
  "grantRole",
  "changePermission",
]);

const automaticActionTools = new Set<AssistantToolCall["name"]>([
  "updateRequestFields",
  "calculateQuote",
  "findAvailableSlots",
  "createQuoteDraft",
  "proposeReschedule",
]);

function reject(name: string, reason: AiToolOrchestrationRejectReason): RejectedAiToolCall {
  return { name, reason, canMutateBusinessTruth: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scopedResourceAllowed(scope: AiToolScope, args: Record<string, unknown>): boolean {
  if (typeof args.workspaceId === "string" && args.workspaceId !== scope.workspaceId) return false;
  if (typeof args.requestId === "string" && scope.allowedRequestIds && !scope.allowedRequestIds.includes(args.requestId)) return false;
  if (typeof args.customerId === "string" && scope.allowedCustomerIds && !scope.allowedCustomerIds.includes(args.customerId)) return false;
  return true;
}

function acceptedTool(name: AssistantToolCall["name"], args: Record<string, unknown>): AcceptedAiToolCall {
  return {
    name,
    arguments: args,
    allowed: true,
    reason: "AI tool call is a proposal only; execution must go through the ServiceDesk facade and provider policy checks.",
    executionBoundary: "SERVICE_DESK_FACADE_ONLY",
    canMutateBusinessTruth: false,
  };
}

export function planAiToolOrchestration(input: {
  scope: AiToolScope;
  requestedToolCalls: unknown[];
  maxToolCalls?: number;
}): AiToolOrchestrationPlan {
  const maxToolCalls = Math.max(0, Math.min(Math.floor(input.maxToolCalls ?? 6), 6));
  const accepted: AcceptedAiToolCall[] = [];
  const rejected: RejectedAiToolCall[] = [];

  for (const raw of input.requestedToolCalls) {
    if (!isRecord(raw) || typeof raw.name !== "string" || !isRecord(raw.arguments ?? {})) {
      rejected.push(reject(isRecord(raw) && typeof raw.name === "string" ? raw.name : "unknown", "SCHEMA_VIOLATION"));
      continue;
    }

    const name = raw.name;
    const args = (raw.arguments ?? {}) as Record<string, unknown>;

    if (accepted.length >= maxToolCalls) {
      rejected.push(reject(name, "TOOL_BUDGET_EXCEEDED"));
      continue;
    }

    if (blockedBusinessTruthTools.has(name)) {
      rejected.push(reject(name, "BUSINESS_TRUTH_TOOL_BLOCKED"));
      continue;
    }

    if (!allowedTools.has(name as AssistantToolCall["name"])) {
      rejected.push(reject(name, "UNKNOWN_TOOL"));
      continue;
    }

    if (input.scope.handoverActive && automaticActionTools.has(name as AssistantToolCall["name"])) {
      rejected.push(reject(name, "HANDOVER_ACTIVE"));
      continue;
    }

    if (!scopedResourceAllowed(input.scope, args)) {
      rejected.push(reject(name, "RESOURCE_OUT_OF_SCOPE"));
      continue;
    }

    accepted.push(acceptedTool(name as AssistantToolCall["name"], args));
  }

  return {
    accepted,
    rejected,
    requiresHumanReview: rejected.length > 0 || accepted.some((tool) => tool.name === "requestHumanReview"),
    businessMutationAllowed: false,
    privateReasoningStored: false,
  };
}
