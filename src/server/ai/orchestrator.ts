import type { ActorContext, Result } from "../../contracts";
import { extractCleaningRequest, missingIntakeQuestions, shouldHandover } from "./extraction";
import { fixtureKnowledge, type ApprovedKnowledgeIndex } from "./knowledge";
import type { AiConversationStore, AiMessageInput, AiService, AssistantToolCall, AssistantTurn } from "./types";

export class InMemoryAiConversationStore implements AiConversationStore {
  readonly messages: Array<{ conversationId: string; workspaceId: string; messageId: string; text: string; receivedAt: string }> = [];

  async appendHumanMessage(input: { conversationId: string; workspaceId: string; messageId: string; text: string; receivedAt: string }): Promise<string> {
    this.messages.push(input);
    return input.messageId;
  }
}

function allowedToolCalls(input: AiMessageInput, handoverReason: string | null): AssistantToolCall[] {
  if (handoverReason) {
    return [{ name: "requestHumanReview", arguments: { reason: handoverReason }, allowed: true, reason: "Unsafe or blocked AI turn." }];
  }

  const calls: AssistantToolCall[] = [
    { name: "getServiceCatalog", arguments: {}, allowed: true, reason: "Needed to map requested service to approved catalog." },
  ];

  if (input.requestId) {
    calls.push({
      name: "updateRequestFields",
      arguments: { requestId: input.requestId },
      allowed: true,
      reason: "Low-risk structured intake update; domain facade still enforces permissions.",
    });
  }

  return calls.slice(0, 6);
}

function replyFor(missingQuestions: string[], handoverReason: string | null): string {
  if (handoverReason) return "Thanks — I have saved your message and will ask a staff member to review it before we continue.";
  if (missingQuestions.length > 0) return missingQuestions.join(" ");
  return "Thanks, I have the main details. I can prepare this for a staff-approved quote and available slots.";
}

export class FixtureAiService implements AiService {
  constructor(
    private readonly store: AiConversationStore = new InMemoryAiConversationStore(),
    private readonly knowledge: ApprovedKnowledgeIndex = fixtureKnowledge,
    private readonly model = "fixture-ai-contract-v1",
    private readonly promptVersion = "servicedesk-ai-v1-intake-2026-10-04",
  ) {}

  async respond(ctx: ActorContext, conversationId: string, input: AiMessageInput): Promise<Result<AssistantTurn>> {
    const savedHumanMessageId = await this.store.appendHumanMessage({
      conversationId,
      workspaceId: ctx.workspaceId,
      messageId: input.messageId,
      text: input.text,
      receivedAt: input.receivedAt,
    });

    const extraction = extractCleaningRequest(input.text);
    const handoverReason = shouldHandover(extraction, input.handoverActive, input.simulateProviderFailure);
    const missingQuestions = handoverReason ? [] : missingIntakeQuestions(extraction);
    const knowledgeResults = this.knowledge.searchApprovedKnowledge(ctx, input.text, 2);

    if (!knowledgeResults.ok) return knowledgeResults;

    return {
      ok: true,
      value: {
        conversationId,
        workspaceId: ctx.workspaceId,
        savedHumanMessageId,
        extraction,
        toolCalls: allowedToolCalls(input, handoverReason),
        replyDraft: replyFor(missingQuestions, handoverReason),
        missingQuestions,
        citations: knowledgeResults.value.map((result) => result.citation),
        handoverRequired: Boolean(handoverReason),
        handoverReason: handoverReason ?? undefined,
        model: this.model,
        promptVersion: this.promptVersion,
        privateReasoningStored: false,
      },
    };
  }
}

export const AiService = new FixtureAiService();
