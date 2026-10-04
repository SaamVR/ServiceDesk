import { describe, expect, test } from "vitest";
import { classifyAiModelFailureForRecovery } from "../../src/server/ai/model-recovery";

describe("AI model recovery classification", () => {
  test("maps transient model failures to retry without business mutation", () => {
    for (const code of ["AI_MODEL_TIMEOUT", "AI_MODEL_RATE_LIMITED", "AI_MODEL_TRANSIENT_FAILURE", "AI_MODEL_NETWORK_FAILURE"]) {
      const decision = classifyAiModelFailureForRecovery({
        code,
        workspaceId: "ws-clearnest",
        conversationId: "conv-1",
        attempts: 1,
        maxAttempts: 4,
        occurredAt: "2026-10-04T08:00:00.000Z",
      });

      expect(decision).toMatchObject({ provider: "AI", action: "RETRY", retryable: true, mutatesBusinessTruth: false, preservesIdempotency: true });
    }
  });

  test("maps configuration/schema problems to non-mutating operator paths", () => {
    expect(classifyAiModelFailureForRecovery({ code: "AI_MODEL_CONFIGURATION_BLOCKED", workspaceId: "ws-clearnest", conversationId: "conv-1", attempts: 0, maxAttempts: 4, occurredAt: "2026-10-04T08:00:00.000Z" })).toMatchObject({ action: "BLOCKED_CONFIGURATION", retryable: false });
    expect(classifyAiModelFailureForRecovery({ code: "AI_MODEL_INVALID_RESPONSE", workspaceId: "ws-clearnest", conversationId: "conv-1", attempts: 1, maxAttempts: 4, occurredAt: "2026-10-04T08:00:00.000Z" })).toMatchObject({ action: "OPERATOR_REVIEW", retryable: false });
  });
});
