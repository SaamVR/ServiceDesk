import { describe, expect, test } from "vitest";
import { buildAiActionAuditRecord } from "../../src/server/ai/action-audit";

describe("AI action audit record", () => {
  test("stores tool summaries and evidence refs without private reasoning", () => {
    const record = buildAiActionAuditRecord({
      workspaceId: "ws-clearnest",
      conversationId: "conv-1",
      messageId: "msg-1",
      model: "gpt-test",
      promptVersion: "owner-assistant-v1",
      toolResults: [
        { toolName: "calculateQuote", outcome: "PROPOSED", evidenceRef: "quote-draft:quote-1", summary: "quoted $340 from core quote engine" },
      ],
      blockedActions: [
        { name: "markPaymentPaid", reason: "BUSINESS_TRUTH_TOOL_BLOCKED" },
      ],
      privateReasoning: "secret chain of thought should never persist",
      capturedAt: "2026-10-04T08:00:00.000Z",
    });

    expect(record).toMatchObject({
      workspaceId: "ws-clearnest",
      privateReasoningStored: false,
      canMutateBusinessTruth: false,
      blockedActionCount: 1,
    });
    expect(JSON.stringify(record)).not.toContain("chain of thought");
    expect(JSON.stringify(record)).not.toContain("secret");
  });
});
