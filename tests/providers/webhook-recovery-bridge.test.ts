import { describe, expect, test } from "vitest";
import { buildWebhookRecoveryEvent, decideWebhookRecovery } from "../../src/server/integrations/webhook/recovery";
import type { WebhookExecutionResult } from "../../src/server/integrations/webhook/executor";

function result(overrides: Partial<WebhookExecutionResult> = {}): WebhookExecutionResult {
  return {
    eventId: "evt_booking_1",
    attempt: 1,
    maxAttempts: 3,
    outcome: "RETRY",
    retryable: true,
    nextAttempt: 2,
    reason: "TRANSIENT_HTTP",
    businessMutationAllowed: false,
    endpointHost: "automation.example.test",
    statusCode: 503,
    ...overrides,
  };
}

describe("webhook recovery bridge", () => {
  test("routes retryable webhook failure into provider recovery policy", () => {
    const event = buildWebhookRecoveryEvent(result(), "2026-10-04T10:00:00.000Z");
    const decision = decideWebhookRecovery(event);

    expect(event).toMatchObject({ provider: "WEBHOOK", operation: "DELIVERY", status: "TRANSIENT_FAILURE", attempts: 1, maxAttempts: 3 });
    expect(decision).toMatchObject({ action: "RETRY", retryable: true, mutatesBusinessTruth: false });
  });

  test("dead-letters deterministic final failures", () => {
    const event = buildWebhookRecoveryEvent(result({ outcome: "FAILED_FINAL", retryable: false, reason: "DETERMINISTIC_HTTP_FAILURE", statusCode: 400 }), "2026-10-04T10:00:00.000Z");
    const decision = decideWebhookRecovery(event);

    expect(event).toMatchObject({ status: "PERMANENT_FAILURE" });
    expect(decision).toMatchObject({ action: "DEAD_LETTER", terminal: true });
  });

  test("routes exhausted transient failures to operator review", () => {
    const event = buildWebhookRecoveryEvent(result({ outcome: "FAILED_FINAL", retryable: false, reason: "MAX_ATTEMPTS_EXHAUSTED", attempt: 3, maxAttempts: 3 }), "2026-10-04T10:00:00.000Z");
    const decision = decideWebhookRecovery(event);

    expect(event).toMatchObject({ status: "TRANSIENT_FAILURE", attempts: 3, maxAttempts: 3 });
    expect(decision).toMatchObject({ action: "OPERATOR_REVIEW", terminal: true });
  });
});
