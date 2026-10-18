import type { Result } from "../../contracts";
import type { AiModelOutput } from "./model-transport";
import { enforceKnowledgeCitations } from "./citation-guard";
import { guardAiModelOutput, guardAiToolCalls } from "./output-guard";
import type { AssistantTurn } from "./types";
import {reviewCustomerReplySafety} from "./reply-safety";

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
  const evaluatedReply = reviewCustomerReplySafety(input.modelOutput.replyDraft);
  if (!evaluatedReply.safe) {
    // Never surface or reuse ungrounded pricing, booking, payment or
    // delivery claims from a model, even as a "draft". Return a redacted
    // staff-handover prompt; no provider delivery is triggered here.
    toolCalls.push({
      name:"requestHumanReview",
      arguments:{reason:"UNVERIFIED_CUSTOMER_REPLY"},
      allowed:true,
      reason:"Model reply contained unverified business claims; a human must review.",
    });
  }
  const handoverRequired = !evaluatedReply.safe ||
    toolCalls.some((call) => call.name === "requestHumanReview") ||
    extraction.value.riskFlags.includes("HUMAN_HANDOVER");

  return {
    ok: true,
    value: {
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      savedHumanMessageId: input.savedHumanMessageId,
      extraction: extraction.value,
      toolCalls,
      replyDraft: evaluatedReply.safe
        ? evaluatedReply.text
        : "A team member will review your service request before any quote or booking is confirmed.",
      missingQuestions: extraction.value.riskFlags.includes("MISSING_REQUIRED_FIELDS") ? ["Please provide the missing service details before we continue."] : [],
      citations: evaluatedReply.safe ? citations.value : [],
      handoverRequired,
      handoverReason: handoverRequired ? "AI model output required guarded human review or requested blocked action." : undefined,
      model: input.model,
      promptVersion: input.promptVersion,
      privateReasoningStored: false,
    },
  };
}
