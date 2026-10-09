import { describe, expect, it, vi } from "vitest";
import {
  PostgresWorkflowExecutionPort,
  runWorkflowExternalTemplateAction,
} from "../../src/server/workflows/postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import type { WorkflowRuleVersionDTO } from "../../src/contracts";

const version: WorkflowRuleVersionDTO = {
  id: "version-1",
  workspaceId: "workspace-1",
  branchId: "branch-1",
  ruleId: "rule-1",
  versionNumber: 2,
  state: "PUBLISHED",
  eventType: "INVOICE_PAID",
  conditions: [],
  actions: [{ type: "CREATE_ATTENTION", severity: "INFO", summaryKey: "PAID_JOB_REVIEW" }],
  maxActionsPerEvent: 2,
  publishedAt: "2026-10-10T00:00:00.000Z",
  createdAt: "2026-10-09T00:00:00.000Z",
};

describe("workflow execution Postgres boundary", () => {
  it("records sanitized evaluation output through the authoritative RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, duplicate: false, executionId: "execution-1", state: "ACTIONS_PENDING", actionCount: 1 },
      error: null,
    });
    const port = new PostgresWorkflowExecutionPort({ rpc } as SupabaseRpcClient, () => "2026-10-10T01:00:00.000Z");
    const result = await port.evaluateAndRecord({
      version,
      mode: "LIVE",
      event: {
        workspaceId: "workspace-1",
        branchId: "branch-1",
        eventType: "INVOICE_PAID",
        snapshot: {
          "invoice.currency": "USD",
          "invoice.branchCode": "MAIN",
          "request.serviceCode": "STANDARD",
        },
        recursionDepth: 0,
      },
    });
    expect(result).toMatchObject({ ok: true, value: { executionId: "execution-1", actionCount: 1 } });
    expect(rpc).toHaveBeenCalledWith("servicedesk_record_workflow_execution", {
      p_input: expect.objectContaining({
        workspaceId: "workspace-1",
        branchId: "branch-1",
        ruleVersionId: "version-1",
        mode: "LIVE",
        matched: true,
      }),
    });
  });

  it("requires owner authority before external action approval or replay", async () => {
    const rpc = vi.fn();
    const port = new PostgresWorkflowExecutionPort({ rpc } as SupabaseRpcClient);
    const dispatcher = { workspaceId: "workspace-1", userId: "dispatcher-1", role: "DISPATCHER" as const };
    await expect(port.approveExternalAction(dispatcher, "action-1"))
      .resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    await expect(port.replayFailedAction(dispatcher, "action-1"))
      .resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails an approved external send safely when no delivery port is configured", async () => {
    const markActionResult = vi.fn().mockResolvedValue({ ok: true, value: { actionExecutionId: "action-1", state: "FAILED" } });
    await expect(runWorkflowExternalTemplateAction({
      action: {
        workspaceId: "workspace-1",
        branchId: "branch-1",
        executionId: "execution-1",
        actionExecutionId: "action-1",
        channel: "EMAIL",
        templateKey: "paid-thanks",
        recipient: "CUSTOMER_PRIMARY",
      },
      persistence: { markActionResult },
    })).resolves.toMatchObject({
      ok: false,
      code: "WORKFLOW_EXTERNAL_SEND_CONFIGURATION_BLOCKED",
    });
    expect(markActionResult).toHaveBeenCalledWith(expect.objectContaining({
      result: "FAILED",
      errorCode: "WORKFLOW_EXTERNAL_SEND_CONFIGURATION_BLOCKED",
    }));
  });

  it("marks an external action succeeded only after the approved template port returns an outbox id", async () => {
    const markActionResult = vi.fn().mockResolvedValue({ ok: true, value: { actionExecutionId: "action-1", state: "SUCCEEDED" } });
    const queueApprovedTemplate = vi.fn().mockResolvedValue({ ok: true, value: { outboxEventId: "outbox-1" } });
    await expect(runWorkflowExternalTemplateAction({
      action: {
        workspaceId: "workspace-1",
        branchId: "branch-1",
        executionId: "execution-1",
        actionExecutionId: "action-1",
        channel: "WHATSAPP",
        templateKey: "visit-thanks",
        recipient: "CUSTOMER_PRIMARY",
      },
      port: { queueApprovedTemplate },
      persistence: { markActionResult },
    })).resolves.toEqual({ ok: true, value: { queued: true, outboxEventId: "outbox-1" } });
    expect(markActionResult).toHaveBeenCalledWith(expect.objectContaining({
      result: "SUCCEEDED",
      outboxEventId: "outbox-1",
    }));
  });
});
