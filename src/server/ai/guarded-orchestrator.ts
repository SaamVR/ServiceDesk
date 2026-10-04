import type { Result } from "../../contracts";
import type { AiModelOutput } from "./model-transport";
import { enforceKnowledgeCitations } from "./citation-guard";
import { guardAiModelOutput, guardAiToolCalls } from "./output-guard";
import type { AssistantTurn } from "./types";

export interface GuardedAssistantPlanInput {
  conversationId: string;
  workspaceId: string;
  savedHumanMessageId: string;
  model: string;
  promptVersion: string;
  modelOutput: AiModelOutput;
  knowledgeResultsUsed: boolean;
}

export function buildGuardedAssistantPlan(input: GuardedAssistantPlanInput): Result<AssistantTurn> {
  const extraction = guardAiModelOutput(input.modelOutput.output);
  if (!extraction.ok) return extraction;

  const citations = enforceKnowledgeCitations({
    replyDraft: input.modelOutput.replyDraft ?? "",
    knowledgeResultsUsed: input.knowledgeResultsUsed,
    citations: input.modelOutput.citations ?? [],
  });
  if (!citations.ok) return citations;

  const toolCalls = guardAiToolCalls(input.modelOutput.requestedToolCalls ?? []);
  const handoverRequired = toolCalls.some((call) => call.name === "requestHumanReview") || extraction.value.riskFlags.includes("HUMAN_HANDOVER");

  return {
    ok: true,
    value: {
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      savedHumanMessageId: input.savedHumanMessageId,
      extraction: extraction.value,
      toolCalls,
      replyDraft: input.modelOutput.replyDraft ?? "Thanks — I saved your message and need a staff member to review the next step.",
      missingQuestions: extraction.value.riskFlags.includes("MISSING_REQUIRED_FIELDS") ? ["Please provide the missing service details before we continue."] : [],
      citations: citations.value,
      handoverRequired,
      handoverReason: handoverRequired ? "AI model output required guarded human review or requested blocked action." : undefined,
      model: input.model,
      promptVersion: input.promptVersion,
      privateReasoningStored: false,
    },
  };
}
