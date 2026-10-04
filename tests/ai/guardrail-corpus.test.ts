import { describe, expect, test } from "vitest";
import { buildGuardedAssistantPlan } from "../../src/server/ai/guarded-orchestrator";
import { guardAiModelOutput, guardAiToolCalls } from "../../src/server/ai/output-guard";

function planFor(output: Parameters<typeof buildGuardedAssistantPlan>[0]["modelOutput"], knowledgeResultsUsed = false) {
  return buildGuardedAssistantPlan({
    conversationId: "conv-corpus",
    workspaceId: "ws-clearnest",
    savedHumanMessageId: "msg-corpus",
    model: "gpt-service-desk",
    promptVersion: "servicedesk-ai-v1-intake-2026-10-04",
    modelOutput: output,
    knowledgeResultsUsed,
  });
}

describe("AI guardrail corpus", () => {
  test.each([
    ["prompt injection", { corrections: [], unsupportedReasons: [], riskFlags: ["PROMPT_INJECTION"] }],
    ["unsupported service", { corrections: [], unsupportedReasons: ["Roof repair is outside cleaning catalog."], riskFlags: ["UNSUPPORTED_WORK"] }],
    ["cross-customer access", { corrections: [], unsupportedReasons: [], riskFlags: ["CROSS_CUSTOMER_ACCESS"] }],
    ["human handover", { corrections: [], unsupportedReasons: [], riskFlags: ["HUMAN_HANDOVER"] }],
  ])("keeps %s as structured risk without inventing business truth", (_name, output) => {
    const guarded = guardAiModelOutput(output);
    expect(guarded.ok).toBe(true);
    if (guarded.ok) {
      expect(guarded.value.corrections).toEqual(output.corrections);
      expect(guarded.value.unsupportedReasons).toEqual(output.unsupportedReasons);
      expect(guarded.value.riskFlags.length).toBeGreaterThan(0);
    }
  });

  test.each([
    "markPaymentPaid",
    "assignCrew",
    "setPrice",
    "confirmAvailability",
    "writeDatabase",
    "applyVerifiedPayment",
  ])("routes unsafe tool %s to human review", (name) => {
    const calls = guardAiToolCalls([{ name, arguments: { id: "private-id" } }]);
    expect(calls).toEqual([expect.objectContaining({ name: "requestHumanReview", allowed: true })]);
  });

  test("does not allow unsupported knowledge answer without citation", () => {
    const result = planFor({
      output: { corrections: [], unsupportedReasons: [], riskFlags: [] },
      replyDraft: "We support a location from policy.",
      citations: [],
    }, true);

    expect(result).toMatchObject({ ok: false, code: "AI_CITATION_REQUIRED" });
  });

  test("allows clarification-only output without citations or tools", () => {
    const result = planFor({
      output: { corrections: [], unsupportedReasons: [], riskFlags: ["MISSING_REQUIRED_FIELDS"] },
      replyDraft: "How many bedrooms and bathrooms should we clean?",
      citations: [],
      requestedToolCalls: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.privateReasoningStored).toBe(false);
  });
});
