import { describe, expect, test } from "vitest";
import { mergeN8nExecutionReceipt, n8nReceiptKey } from "../../src/server/integrations/n8n/receipt";

describe("n8n execution receipt idempotency", () => {
  test("keys receipts by workspace workflow execution and triggering event", () => {
    expect(n8nReceiptKey({ workspaceId: "ws-1", workflowId: "wf-1", executionId: "exec-1", triggeredEventId: "evt-1" })).toBe("n8n:ws-1:wf-1:exec-1:evt-1");
  });

  test("running receipt can be completed without duplicating automation delivery", () => {
    const running = mergeN8nExecutionReceipt(undefined, {
      workspaceId: "ws-1",
      workflowId: "wf-1",
      executionId: "exec-1",
      triggeredEventId: "evt-1",
      status: "running",
      deliveryState: "PENDING_AUTOMATION_COMPLETION",
      capturedAt: "2026-10-04T08:00:00.000Z",
    });
    const done = mergeN8nExecutionReceipt(running.receipt, {
      workspaceId: "ws-1",
      workflowId: "wf-1",
      executionId: "exec-1",
      triggeredEventId: "evt-1",
      status: "success",
      deliveryState: "DELIVERED_TO_AUTOMATION",
      capturedAt: "2026-10-04T08:03:00.000Z",
    });

    expect(running).toMatchObject({ result: "INSERTED", receipt: { final: false } });
    expect(done).toMatchObject({ result: "UPDATED", receipt: { final: true, businessMutationAllowed: false } });
  });

  test("duplicate final receipt preserves original completion evidence", () => {
    const current = mergeN8nExecutionReceipt(undefined, {
      workspaceId: "ws-1",
      workflowId: "wf-1",
      executionId: "exec-1",
      triggeredEventId: "evt-1",
      status: "success",
      deliveryState: "DELIVERED_TO_AUTOMATION",
      capturedAt: "2026-10-04T08:03:00.000Z",
    }).receipt;
    const duplicate = mergeN8nExecutionReceipt(current, {
      workspaceId: "ws-1",
      workflowId: "wf-1",
      executionId: "exec-1",
      triggeredEventId: "evt-1",
      status: "success",
      deliveryState: "DELIVERED_TO_AUTOMATION",
      capturedAt: "2026-10-04T08:05:00.000Z",
    });

    expect(duplicate).toMatchObject({ result: "DUPLICATE_FINAL", receipt: { capturedAt: "2026-10-04T08:03:00.000Z" } });
  });
});
