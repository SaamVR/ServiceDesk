import type { AiToolOrchestrationRejectReason } from "./tool-orchestration";

export interface AiToolResultSummary {
  toolName: string;
  outcome: "PROPOSED" | "COMPLETED" | "BLOCKED" | "FAILED";
  evidenceRef?: string;
  summary: string;
}

export interface AiBlockedActionSummary {
  name: string;
  reason: AiToolOrchestrationRejectReason | string;
}

export interface AiActionAuditInput {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  model: string;
  promptVersion: string;
  toolResults: AiToolResultSummary[];
  blockedActions: AiBlockedActionSummary[];
  privateReasoning?: string;
  capturedAt: string;
}

export interface AiActionAuditRecord {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  model: string;
  promptVersion: string;
  capturedAt: string;
  toolResults: AiToolResultSummary[];
  blockedActions: AiBlockedActionSummary[];
  blockedActionCount: number;
  privateReasoningStored: false;
  canMutateBusinessTruth: false;
}

function redact(value: string): string {
  return value
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/sk_(live|test)_[A-Za-z0-9_\-]+/g, "[redacted-secret]")
    .replace(/whsec_[A-Za-z0-9_\-]+/g, "[redacted-secret]")
    .replace(/chain of thought/gi, "private reasoning");
}

export function buildAiActionAuditRecord(input: AiActionAuditInput): AiActionAuditRecord {
  return {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    model: input.model,
    promptVersion: input.promptVersion,
    capturedAt: input.capturedAt,
    toolResults: input.toolResults.map((result) => ({
      ...result,
      summary: redact(result.summary),
    })),
    blockedActions: input.blockedActions.map((action) => ({ ...action })),
    blockedActionCount: input.blockedActions.length,
    privateReasoningStored: false,
    canMutateBusinessTruth: false,
  };
}
