import { describe, expect, test } from "vitest";
import { buildN8nRecoveryEvent, decideN8nRecovery } from "../../src/server/integrations/n8n/recovery";

describe("n8n recovery bridge", () => {
  test("maps retryable automation failures to provider recovery retry", () => {
    const event = buildN8nRecoveryEvent({
      workspaceId: "ws-1",
      workflowId: "wf-1",
      executionId: "exec-1",
      triggeredEventId: "evt-1",
      deliveryState: "RETRYABLE_FAILURE",
      attempts: 1,
      maxAttempts: 4,
      occurredAt: "2026-10-04T08:00:00.000Z",
    });
    const decision = decideN8nRecovery(event);

    expect(event).toMatchObject({ provider: "WEBHOOK", operation: "DELIVERY", status: "TRANSIENT_FAILURE", idempotencyKey: "n8n:ws-1:wf-1:exec-1:evt-1" });
    expect(decision).toMatchObject({ action: "RETRY", retryable: true, mutatesBusinessTruth: false });
  });

  test("maps blocked and final automation failures to operator-safe terminal decisions", () => {
    const blocked = decideN8nRecovery(buildN8nRecoveryEvent({
      workspaceId: "ws-1",
      workflowId: "wf-1",
      executionId: "exec-1",
      triggeredEventId: "evt-1",
      deliveryState: "CONFIGURATION_BLOCKED",
      attempts: 1,
      maxAttempts: 4,
      occurredAt: "2026-10-04T08:00:00.000Z",
    }));
    const final = decideN8nRecovery(buildN8nRecoveryEvent({
      workspaceId: "ws-1",
      workflowId: "wf-1",
      executionId: "exec-2",
      triggeredEventId: "evt-2",
      deliveryState: "FINAL_FAILURE",
      attempts: 4,
      maxAttempts: 4,
      occurredAt: "2026-10-04T08:10:00.000Z",
    }));

    expect(blocked).toMatchObject({ action: "BLOCKED_CONFIGURATION", terminal: true });
    expect(final).toMatchObject({ action: "DEAD_LETTER", terminal: true });
  });
});
