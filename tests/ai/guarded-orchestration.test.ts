import { describe, expect, test } from "vitest";
import { buildGuardedAssistantPlan } from "../../src/server/ai/guarded-orchestrator";

const citation = { documentId: "faq-clearnest-areas", title: "ClearNest service areas", version: 1, chunkId: "areas-1" };

describe("guarded AI model orchestration", () => {
  test("builds a safe assistant plan from valid model output", () => {
    const result = buildGuardedAssistantPlan({
      conversationId: "conv-1",
      workspaceId: "ws-clearnest",
      savedHumanMessageId: "msg-1",
      model: "gpt-service-desk",
      promptVersion: "servicedesk-ai-v1-intake-2026-10-04",
      modelOutput: {
        output: { serviceCode: "DEEP", bedrooms: 2, bathrooms: 1, corrections: [], unsupportedReasons: [], riskFlags: [] },
        replyDraft: "ClearNest covers Camden.",
        requestedToolCalls: [{ name: "searchApprovedKnowledge", arguments: { query: "Camden" } }],
        citations: [citation],
      },
      knowledgeResultsUsed: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.privateReasoningStored).toBe(false);
      expect(result.value.toolCalls).toEqual([expect.objectContaining({ name: "searchApprovedKnowledge", allowed: true })]);
      expect(result.value.citations).toEqual([citation]);
    }
  });

  test("blocks fake payment and fake pricing requests into human review", () => {
    const result = buildGuardedAssistantPlan({
      conversationId: "conv-1",
      workspaceId: "ws-clearnest",
      savedHumanMessageId: "msg-1",
      model: "gpt-service-desk",
      promptVersion: "v1",
      modelOutput: {
        output: { corrections: [], unsupportedReasons: [], riskFlags: [] },
        replyDraft: "I cannot mark payment paid or set a price myself.",
        requestedToolCalls: [
          { name: "markPaymentPaid", arguments: { invoiceId: "invoice-1" } },
          { name: "setPrice", arguments: { amountMinor: 1 } },
        ],
        citations: [],
      },
      knowledgeResultsUsed: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toolCalls.every((call) => call.name === "requestHumanReview")).toBe(true);
      expect(result.value.handoverRequired).toBe(true);
    }
  });

  test("fails safe when model uses knowledge without citation", () => {
    const result = buildGuardedAssistantPlan({
      conversationId: "conv-1",
      workspaceId: "ws-clearnest",
      savedHumanMessageId: "msg-1",
      model: "gpt-service-desk",
      promptVersion: "v1",
      modelOutput: {
        output: { corrections: [], unsupportedReasons: [], riskFlags: [] },
        replyDraft: "We cover Camden.",
        citations: [],
      },
      knowledgeResultsUsed: true,
    });

    expect(result).toMatchObject({ ok: false, code: "AI_CITATION_REQUIRED" });
  });
});
