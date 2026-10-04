import { describe, expect, test } from "vitest";
import { buildN8nExecutionReceipt, summarizeN8nExecutionReceipt } from "../../src/server/integrations/n8n/execution";

describe("n8n execution receipt boundary", () => {
  test("marks a controlled successful execution as contract evidence only", () => {
    const receipt = buildN8nExecutionReceipt({
      workspaceId: "ws-clearnest",
      workflowId: "wf-booking-confirmed",
      workflowName: "Booking confirmed staff alert",
      executionId: "exec-123",
      status: "success",
      startedAt: "2026-10-04T10:00:00.000Z",
      finishedAt: "2026-10-04T10:00:03.000Z",
      controlledReceiver: true,
      redactedOutputRef: "sha256:output-redacted",
      triggeredEventId: "evt-booking-confirmed-1",
    });

    expect(receipt.evidence).toMatchObject({
      provider: "WEBHOOK",
      mode: "SANDBOX",
      verification: "CONTRACT_TESTED",
      controlledId: "exec-123",
    });
    expect(receipt.businessMutationAllowed).toBe(false);
  });

  test("does not treat missing controlled receiver as provider proof", () => {
    const receipt = buildN8nExecutionReceipt({
      workspaceId: "ws-clearnest",
      workflowId: "wf-booking-confirmed",
      workflowName: "Booking confirmed staff alert",
      executionId: "exec-124",
      status: "success",
      startedAt: "2026-10-04T10:00:00.000Z",
      finishedAt: "2026-10-04T10:00:03.000Z",
      controlledReceiver: false,
      triggeredEventId: "evt-booking-confirmed-1",
    });

    expect(receipt.evidence.verification).toBe("CONFIGURATION_BLOCKED");
    expect(receipt.blockers).toContain("controlled_receiver_missing");
  });

  test("classifies failed workflow execution as retryable when it is transient", () => {
    const receipt = buildN8nExecutionReceipt({
      workspaceId: "ws-clearnest",
      workflowId: "wf-booking-confirmed",
      workflowName: "Booking confirmed staff alert",
      executionId: "exec-125",
      status: "failed",
      startedAt: "2026-10-04T10:00:00.000Z",
      finishedAt: "2026-10-04T10:00:03.000Z",
      controlledReceiver: true,
      triggeredEventId: "evt-booking-confirmed-1",
      errorCode: "ECONNRESET",
    });

    expect(receipt.deliveryState).toBe("RETRYABLE_FAILURE");
    expect(receipt.retryRecommended).toBe(true);
  });

  test("summarizes executions without leaking payload content", () => {
    const summary = summarizeN8nExecutionReceipt(
      buildN8nExecutionReceipt({
        workspaceId: "ws-clearnest",
        workflowId: "wf-booking-confirmed",
        workflowName: "Booking confirmed staff alert",
        executionId: "exec-126",
        status: "success",
        startedAt: "2026-10-04T10:00:00.000Z",
        finishedAt: "2026-10-04T10:00:03.000Z",
        controlledReceiver: true,
        redactedOutputRef: "sha256:output-redacted",
        triggeredEventId: "evt-booking-confirmed-1",
      }),
    );

    expect(summary).toEqual({
      workspaceId: "ws-clearnest",
      workflowId: "wf-booking-confirmed",
      executionId: "exec-126",
      status: "success",
      deliveryState: "DELIVERED_TO_AUTOMATION",
      evidenceVerification: "CONTRACT_TESTED",
      businessMutationAllowed: false,
    });
  });
});
