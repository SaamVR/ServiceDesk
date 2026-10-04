import { describe, expect, test } from "vitest";
import { linkWebhookDeliveryToN8nExecution } from "../../src/server/integrations/webhook/n8n-linkage";
import type { WebhookExecutionResult } from "../../src/server/integrations/webhook/executor";
import { buildN8nExecutionReceipt } from "../../src/server/integrations/n8n/execution";

const delivered: WebhookExecutionResult = {
  eventId: "evt_booking_1",
  attempt: 1,
  maxAttempts: 3,
  outcome: "DELIVERED",
  retryable: false,
  reason: "SUCCESS",
  businessMutationAllowed: false,
  endpointHost: "automation.example.test",
  statusCode: 202,
};

describe("webhook to n8n execution linkage", () => {
  test("links ServiceDesk event to controlled n8n receipt without granting mutation authority", () => {
    const receipt = buildN8nExecutionReceipt({
      workspaceId: "ws-clearnest",
      workflowId: "wf_booking_confirmed",
      workflowName: "Booking confirmed alert",
      executionId: "exec_123",
      status: "success",
      startedAt: "2026-10-04T10:00:01.000Z",
      finishedAt: "2026-10-04T10:00:05.000Z",
      triggeredEventId: "evt_booking_1",
      controlledReceiver: true,
      redactedOutputRef: "n8n-receipt:exec_123",
    });

    const linked = linkWebhookDeliveryToN8nExecution(delivered, receipt);

    expect(linked).toMatchObject({
      eventId: "evt_booking_1",
      executionId: "exec_123",
      linkageState: "LINKED",
      businessMutationAllowed: false,
      evidenceVerification: "CONTRACT_TESTED",
    });
    expect(JSON.stringify(linked)).not.toContain("customer_ref");
  });

  test("flags event mismatch for operator review", () => {
    const receipt = buildN8nExecutionReceipt({
      workspaceId: "ws-clearnest",
      workflowId: "wf_booking_confirmed",
      workflowName: "Booking confirmed alert",
      executionId: "exec_other",
      status: "success",
      startedAt: "2026-10-04T10:00:01.000Z",
      finishedAt: "2026-10-04T10:00:05.000Z",
      triggeredEventId: "evt_other",
      controlledReceiver: true,
      redactedOutputRef: "n8n-receipt:exec_other",
    });

    const linked = linkWebhookDeliveryToN8nExecution(delivered, receipt);
    expect(linked).toMatchObject({ linkageState: "EVENT_MISMATCH", requiresOperator: true, businessMutationAllowed: false });
  });

  test("keeps failed webhook delivery separate from n8n success proof", () => {
    const failed: WebhookExecutionResult = { ...delivered, outcome: "FAILED_FINAL", retryable: false, reason: "DETERMINISTIC_HTTP_FAILURE", statusCode: 400 };
    const receipt = buildN8nExecutionReceipt({
      workspaceId: "ws-clearnest",
      workflowId: "wf_booking_confirmed",
      workflowName: "Booking confirmed alert",
      executionId: "exec_123",
      status: "success",
      startedAt: "2026-10-04T10:00:01.000Z",
      finishedAt: "2026-10-04T10:00:05.000Z",
      triggeredEventId: "evt_booking_1",
      controlledReceiver: true,
      redactedOutputRef: "n8n-receipt:exec_123",
    });

    const linked = linkWebhookDeliveryToN8nExecution(failed, receipt);
    expect(linked).toMatchObject({ linkageState: "WEBHOOK_NOT_DELIVERED", requiresOperator: true });
  });
});
