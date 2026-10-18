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
  // Inbound model output and its surrounding receipt may be reconstructed
  // from remote JSON. Validate that the saved message and scoped turn are
  // actually bound before building any staff-visible or executable proposal.
  const safeId=(value:unknown)=>typeof value==="string" &&
    /^[A-Za-z0-9:_-]{3,128}$/.test(value);
  const safeLabel=(value:unknown)=>typeof value==="string" &&
    value.length>=1 && value.length<=128 &&
    /^[A-Za-z0-9._:-]+$/.test(value);
  if (!input || !safeId(input.conversationId) ||
      !safeId(input.workspaceId) || !safeId(input.savedHumanMessageId) ||
      !safeLabel(input.model) || !safeLabel(input.promptVersion) ||
      typeof input.knowledgeResultsUsed!=="boolean" ||
      !input.modelOutput || typeof input.modelOutput!=="object" ||
      Array.isArray(input.modelOutput) ||
      Object.getPrototypeOf(input.modelOutput)!==Object.prototype ||
      Object.getOwnPropertySymbols(input.modelOutput).length!==0 ||
      Object.getOwnPropertyNames(input.modelOutput).length!==Object.keys(input.modelOutput).length ||
      Object.values(Object.getOwnPropertyDescriptors(input.modelOutput))
        .some(desc=>!Object.hasOwn(desc,"value"))) {
    return {ok:false,code:"AI_TURN_SCOPE_UNVERIFIED",
      message:"A saved, scoped conversation turn is required before model suggestions can be reviewed."};
  }
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
  // A model can say "hello" while simultaneously trying an unauthorized
  // money or cross-customer action. Human-review/tool flags take precedence
  // over its apparently harmless text. Never surface that mixed output as
  // a customer-ready recommendation.
  const handoverRequired = !evaluatedReply.safe ||
    toolCalls.some((call) => call.name === "requestHumanReview") ||
    extraction.value.riskFlags.some(flag=>[
      "HUMAN_HANDOVER","PROMPT_INJECTION","CROSS_CUSTOMER_ACCESS",
      "PROVIDER_FAILURE","UNSUPPORTED_WORK","UNSUPPORTED_AREA",
    ].includes(flag));

  return {
    ok: true,
    value: {
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      savedHumanMessageId: input.savedHumanMessageId,
      extraction: extraction.value,
      toolCalls,
      replyDraft: !handoverRequired && evaluatedReply.safe
        ? evaluatedReply.text
        : "A team member will review your service request before any quote or booking is confirmed.",
      missingQuestions: extraction.value.riskFlags.includes("MISSING_REQUIRED_FIELDS") ? ["Please provide the missing service details before we continue."] : [],
      citations: !handoverRequired && evaluatedReply.safe ? citations.value : [],
      handoverRequired,
      handoverReason: handoverRequired ? "AI model output required guarded human review or requested blocked action." : undefined,
      model: input.model,
      promptVersion: input.promptVersion,
      privateReasoningStored: false,
    },
  };
}
