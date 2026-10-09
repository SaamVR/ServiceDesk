import type { ActorContext, Result, WorkflowRuleVersionDTO } from "../../contracts";
import type { SupabaseRpcClient } from "../core/payment-application-postgres";
import {
  evaluateWorkflowRule,
  workflowExecutionKey,
  type WorkflowEvaluationPlan,
  type WorkflowEventEnvelope,
} from "./engine";

type Row = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function text(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export interface WorkflowRecordedExecution {
  executionId: string;
  state: string;
  duplicate: boolean;
  actionCount: number;
  plan: WorkflowEvaluationPlan;
}

export interface WorkflowReplayResult {
  actionExecutionId: string;
  state: string;
  attemptNumber: number;
  sourceBookingReplayed: false;
}

export class PostgresWorkflowExecutionPort {
  constructor(
    private readonly client: SupabaseRpcClient,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async evaluateAndRecord(input: {
    version: WorkflowRuleVersionDTO;
    event: WorkflowEventEnvelope;
    mode: "PREVIEW" | "LIVE";
    previewNonce?: string;
  }): Promise<Result<WorkflowRecordedExecution>> {
    const evaluated = evaluateWorkflowRule(input.version, input.event, input.mode);
    if (!evaluated.ok) return evaluated;

    const executionKey = workflowExecutionKey({
      mode: input.mode,
      ruleVersionId: input.version.id,
      eventFingerprint: evaluated.value.eventFingerprint,
      previewNonce: input.previewNonce,
    });

    const { data, error } = await this.client.rpc<Row>("servicedesk_record_workflow_execution", {
      p_input: {
        workspaceId: input.event.workspaceId,
        branchId: input.event.branchId,
        ruleVersionId: input.version.id,
        mode: input.mode,
        executionKey,
        eventFingerprint: evaluated.value.eventFingerprint,
        eventSnapshot: input.event.snapshot,
        matched: evaluated.value.matched,
        recursionDepth: input.event.recursionDepth,
        parentExecutionId: input.event.parentExecutionId,
        now: this.now(),
      },
    });

    if (error) return fail(error.code ?? "WORKFLOW_EXECUTION_RPC_ERROR", error.message);
    if (!data || data.ok !== true) {
      return fail(String(data?.code ?? "WORKFLOW_EXECUTION_REJECTED"), "Workflow execution was rejected.");
    }

    const executionId = text(data, "executionId");
    const state = text(data, "state");
    if (!executionId || !state) {
      return fail("WORKFLOW_EXECUTION_RPC_MALFORMED", "Workflow execution response was malformed.");
    }

    return {
      ok: true,
      value: {
        executionId,
        state,
        duplicate: data.duplicate === true,
        actionCount: typeof data.actionCount === "number" ? data.actionCount : evaluated.value.actionPlans.length,
        plan: evaluated.value,
      },
    };
  }

  async approveExternalAction(
    actor: ActorContext,
    actionExecutionId: string,
  ): Promise<Result<{ actionExecutionId: string; state: string }>> {
    if (!actor.userId || actor.role !== "OWNER") {
      return fail("FORBIDDEN", "Only an owner can approve an external workflow send.");
    }
    const { data, error } = await this.client.rpc<Row>("servicedesk_approve_workflow_external_action", {
      p_input: {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        actionExecutionId,
        now: this.now(),
      },
    });
    if (error) return fail(error.code ?? "WORKFLOW_APPROVAL_RPC_ERROR", error.message);
    if (!data || data.ok !== true) {
      return fail(String(data?.code ?? "WORKFLOW_APPROVAL_REJECTED"), "Workflow action approval was rejected.");
    }
    const id = text(data, "actionExecutionId");
    const state = text(data, "state");
    if (!id || !state) return fail("WORKFLOW_APPROVAL_RPC_MALFORMED", "Workflow approval response was malformed.");
    return { ok: true, value: { actionExecutionId: id, state } };
  }

  async executeAttentionAction(
    workspaceId: string,
    actionExecutionId: string,
  ): Promise<Result<{ actionExecutionId: string; attentionItemId: string }>> {
    const { data, error } = await this.client.rpc<Row>("servicedesk_execute_workflow_attention_action", {
      p_input: {
        workspaceId,
        actionExecutionId,
        now: this.now(),
      },
    });
    if (error) return fail(error.code ?? "WORKFLOW_ATTENTION_RPC_ERROR", error.message);
    if (!data || data.ok !== true) {
      return fail(String(data?.code ?? "WORKFLOW_ATTENTION_REJECTED"), "Workflow attention action was rejected.");
    }
    const id = text(data, "actionExecutionId");
    const attentionItemId = text(data, "attentionItemId");
    if (!id || !attentionItemId) {
      return fail("WORKFLOW_ATTENTION_RPC_MALFORMED", "Workflow attention response was malformed.");
    }
    return { ok: true, value: { actionExecutionId: id, attentionItemId } };
  }

  async markActionResult(input: {
    workspaceId: string;
    actionExecutionId: string;
    result: "SUCCEEDED" | "FAILED" | "SUPPRESSED";
    errorCode?: string;
    outboxEventId?: string;
  }): Promise<Result<{ actionExecutionId: string; state: string }>> {
    const { data, error } = await this.client.rpc<Row>("servicedesk_mark_workflow_action_result", {
      p_input: {
        workspaceId: input.workspaceId,
        actionExecutionId: input.actionExecutionId,
        result: input.result,
        errorCode: input.errorCode,
        outboxEventId: input.outboxEventId,
        now: this.now(),
      },
    });
    if (error) return fail(error.code ?? "WORKFLOW_ACTION_RESULT_RPC_ERROR", error.message);
    if (!data || data.ok !== true) {
      return fail(String(data?.code ?? "WORKFLOW_ACTION_RESULT_REJECTED"), "Workflow action result was rejected.");
    }
    const id = text(data, "actionExecutionId");
    const state = text(data, "state");
    if (!id || !state) return fail("WORKFLOW_ACTION_RESULT_RPC_MALFORMED", "Workflow action response was malformed.");
    return { ok: true, value: { actionExecutionId: id, state } };
  }

  async replayFailedAction(
    actor: ActorContext,
    actionExecutionId: string,
  ): Promise<Result<WorkflowReplayResult>> {
    if (!actor.userId || actor.role !== "OWNER") {
      return fail("FORBIDDEN", "Only an owner can replay a failed workflow action.");
    }
    const { data, error } = await this.client.rpc<Row>("servicedesk_replay_failed_workflow_action", {
      p_input: {
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        actorRole: actor.role,
        actionExecutionId,
        now: this.now(),
      },
    });
    if (error) return fail(error.code ?? "WORKFLOW_REPLAY_RPC_ERROR", error.message);
    if (!data || data.ok !== true) {
      return fail(String(data?.code ?? "WORKFLOW_REPLAY_REJECTED"), "Workflow action replay was rejected.");
    }
    const id = text(data, "actionExecutionId");
    const state = text(data, "state");
    const attemptNumber = typeof data.attemptNumber === "number" ? data.attemptNumber : Number.NaN;
    if (!id || !state || !Number.isInteger(attemptNumber) || data.sourceBookingReplayed !== false) {
      return fail("WORKFLOW_REPLAY_RPC_MALFORMED", "Workflow replay response was malformed.");
    }
    return {
      ok: true,
      value: {
        actionExecutionId: id,
        state,
        attemptNumber,
        sourceBookingReplayed: false,
      },
    };
  }
}

export interface WorkflowExternalTemplateAction {
  workspaceId: string;
  branchId: string;
  executionId: string;
  actionExecutionId: string;
  channel: "EMAIL" | "WHATSAPP";
  templateKey: string;
  recipient: "CUSTOMER_PRIMARY";
}

export interface WorkflowExternalTemplatePort {
  queueApprovedTemplate(
    action: WorkflowExternalTemplateAction,
  ): Promise<Result<{ outboxEventId: string }>>;
}

export async function runWorkflowExternalTemplateAction(input: {
  action: WorkflowExternalTemplateAction;
  port?: WorkflowExternalTemplatePort;
  persistence: Pick<PostgresWorkflowExecutionPort, "markActionResult">;
}): Promise<Result<{ queued: boolean; outboxEventId?: string }>> {
  if (!input.port) {
    const marked = await input.persistence.markActionResult({
      workspaceId: input.action.workspaceId,
      actionExecutionId: input.action.actionExecutionId,
      result: "FAILED",
      errorCode: "WORKFLOW_EXTERNAL_SEND_CONFIGURATION_BLOCKED",
    });
    if (!marked.ok) return marked;
    return {
      ok: false,
      code: "WORKFLOW_EXTERNAL_SEND_CONFIGURATION_BLOCKED",
      message: "No approved workflow-template delivery port is configured.",
    };
  }

  const queued = await input.port.queueApprovedTemplate(input.action);
  if (!queued.ok) {
    const marked = await input.persistence.markActionResult({
      workspaceId: input.action.workspaceId,
      actionExecutionId: input.action.actionExecutionId,
      result: "FAILED",
      errorCode: queued.code,
    });
    if (!marked.ok) return marked;
    return queued;
  }

  const marked = await input.persistence.markActionResult({
    workspaceId: input.action.workspaceId,
    actionExecutionId: input.action.actionExecutionId,
    result: "SUCCEEDED",
    outboxEventId: queued.value.outboxEventId,
  });
  if (!marked.ok) return marked;

  return { ok: true, value: { queued: true, outboxEventId: queued.value.outboxEventId } };
}
