import type { ActorContext, Result } from "../../contracts";
import { buildGuardedAssistantPlan } from "./guarded-orchestrator";
import type { ApprovedKnowledgeIndex, KnowledgeSearchResult } from "./knowledge";
import {
  callAiModel, type AiModelHttpTransport, type AiModelTransportConfig,
} from "./model-transport";
import { planAiToolOrchestration } from "./tool-orchestration";
import type {
  AiConversationStore, AiMessageInput, AiService, AssistantTurn, KnowledgeCitation,
} from "./types";

export interface ConfiguredAiServiceDependencies {
  store: AiConversationStore;
  knowledge: ApprovedKnowledgeIndex;
  modelConfig: AiModelTransportConfig;
  http: AiModelHttpTransport;
  promptVersion: string;
}

function citationKey(citation: KnowledgeCitation): string {
  return JSON.stringify([citation.documentId, citation.title, citation.version, citation.chunkId]);
}

/**
 * No automatic provider sends, invoice mutations, owner role grants or
 * payment/availability decisions. Every model tool call is a proposal only.
 */
export function createConfiguredAiService(deps: ConfiguredAiServiceDependencies): AiService {
  return {
    async respond(ctx: ActorContext, conversationId: string, input: AiMessageInput): Promise<Result<AssistantTurn>> {
      if (!ctx.workspaceId?.trim() || !conversationId?.trim() || !input.messageId?.trim() ||
          !input.text?.trim() || input.text.length > 8_000 ||
          !Number.isFinite(Date.parse(input.receivedAt))) {
        return { ok: false, code: "AI_MESSAGE_INVALID",
          message: "AI intake requires a bounded message, authenticated workspace, and valid timestamp." };
      }

      let savedHumanMessageId: string;
      try {
        savedHumanMessageId = await deps.store.appendHumanMessage({
          conversationId, workspaceId: ctx.workspaceId, messageId: input.messageId,
          text: input.text, receivedAt: input.receivedAt,
        });
      } catch {
        return { ok: false, code: "AI_MESSAGE_PERSISTENCE_FAILED",
          message: "The incoming message could not be saved; no AI response was created." };
      }
      if (!savedHumanMessageId) {
        return { ok: false, code: "AI_MESSAGE_PERSISTENCE_FAILED",
          message: "The incoming message did not receive a persisted identity." };
      }

      const fallback = (reason: string): Result<AssistantTurn> => ({
        ok: true,
        value: {
          conversationId,
          workspaceId: ctx.workspaceId,
          savedHumanMessageId,
          extraction: { corrections: [], unsupportedReasons: [], riskFlags: ["HUMAN_HANDOVER"] },
          toolCalls: [{
            name: "requestHumanReview", arguments: { reason }, allowed: true,
            reason: "Operator review is required; no business command was executed.",
          }],
          replyDraft: "Thanks. Your message was saved, but a staff member needs to review the next step.",
          missingQuestions: [], citations: [],
          handoverRequired: true,
          handoverReason: reason,
          model: deps.modelConfig.model,
          promptVersion: deps.promptVersion,
          privateReasoningStored: false,
        },
      });

      if (input.handoverActive || input.simulateProviderFailure) {
        return fallback(input.handoverActive ? "HUMAN_HANDOVER_ACTIVE" : "AI_PROVIDER_UNAVAILABLE");
      }

      const knowledge = deps.knowledge.searchApprovedKnowledge(ctx, input.text, 3);
      if (!knowledge.ok) return fallback("KNOWLEDGE_READ_FAILED");
      const available: KnowledgeSearchResult[] = knowledge.value;
      const response = await callAiModel(deps.modelConfig, {
        conversationId,
        workspaceId: ctx.workspaceId,
        promptVersion: deps.promptVersion,
        userText: input.text,
        approvedKnowledgeRefs: available.map(item => item.citation.documentId),
        approvedKnowledgeSnippets: available.map(item => ({
          documentId: item.citation.documentId,
          chunkId: item.citation.chunkId,
          snippet: item.snippet,
        })),
      }, deps.http);
      if (!response.ok) return fallback("AI_PROVIDER_OR_OUTPUT_UNAVAILABLE");

      const allowedCitations = new Set(available.map(item => citationKey(item.citation)));
      const citations = response.value.citations ?? [];
      if (citations.some(c => !c || !allowedCitations.has(citationKey(c)))) {
        return fallback("AI_KNOWLEDGE_CITATION_UNVERIFIED");
      }
      if (!response.value.replyDraft?.trim()) return fallback("AI_REPLY_MISSING");

      const guarded = buildGuardedAssistantPlan({
        conversationId,
        workspaceId: ctx.workspaceId,
        savedHumanMessageId,
        model: deps.modelConfig.model,
        promptVersion: deps.promptVersion,
        modelOutput: response.value,
        knowledgeResultsUsed: available.length > 0,
      });
      if (!guarded.ok) return fallback("AI_OUTPUT_GUARD_REJECTED");

      const plannedTools = planAiToolOrchestration({
        scope: {
          workspaceId: ctx.workspaceId,
          allowedRequestIds: input.requestId ? [input.requestId] : [],
          allowedCustomerIds: input.customerId ? [input.customerId] : [],
          handoverActive: Boolean(input.handoverActive),
        },
        requestedToolCalls: response.value.requestedToolCalls ?? [],
        maxToolCalls: 6,
      });
      if (plannedTools.rejected.length > 0) return fallback("AI_TOOL_SCOPE_REJECTED");

      return {
        ok: true,
        value: {
          ...guarded.value,
          // Accepted tool plans still require the ServiceDesk facade. Never
          // execute model requests or change authoritative business state here.
          toolCalls: plannedTools.accepted,
          handoverRequired: guarded.value.handoverRequired || plannedTools.requiresHumanReview,
          handoverReason: (guarded.value.handoverRequired || plannedTools.requiresHumanReview)
            ? (guarded.value.handoverReason ?? "AI_REQUESTED_OPERATOR_REVIEW")
            : undefined,
          privateReasoningStored: false,
        },
      };
    },
  };
}
