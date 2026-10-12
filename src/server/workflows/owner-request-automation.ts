import type { Result, WorkflowRuleVersionDTO } from "../../contracts";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { PostgresWorkflowExecutionPort } from "./postgres";

type Resolver = typeof resolveStaffActor;

export interface OwnerRequestAutomationDependencies {
  resolveActor?: Resolver;
  mode?: typeof operationalDatabaseMode;
  portFactory?: (rpc: ConstructorParameters<typeof PostgresWorkflowExecutionPort>[0]) =>
    Pick<PostgresWorkflowExecutionPort, "evaluateAndRecord" | "executeAttentionAction">;
}

export interface OwnerRequestAutomationReceipt {
  state: "PERSISTED_INTERNAL_WORKFLOW_PROCESSING";
  requestId: string;
  matchedExecutions: number;
  completedAttentionActions: number;
  externalApprovalRequired: number;
  providerMessagesSent: 0;
  replayedSourceEvent: boolean;
  newlyRecordedRuleExecutions: number;
  reusedRuleExecutions: number;
}

function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}

function isUuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}
function safeCode(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : "";
}

/**
 * Owner-triggered replay/evaluation of ONE persisted request-created source
 * event. This intentionally is not an automatic provider webhook. SQL owns
 * source-event idempotency and authoritative action writes. Only internal
 * CREATE_ATTENTION pending actions are executed; outbound template actions
 * remain owner-approval-required and are never queued here.
 */
export async function runOwnerSavedRequestAutomation(
  workspaceSlug: string,
  requestId: string,
  deps: OwnerRequestAutomationDependencies = {},
): Promise<Result<OwnerRequestAutomationReceipt>> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug) ||
      workspaceSlug.length < 3 || workspaceSlug.length > 40 || !isUuid(requestId)) {
    return fail("REQUEST_WORKFLOW_INPUT_INVALID", "Select a valid saved cleaning request.");
  }
  // The underlying rule and execution RPCs are service-role-only. An RLS
  // session must never silently be promoted or used to bypass that boundary.
  if ((deps.mode ?? operationalDatabaseMode)() !== "SERVICE_ROLE") {
    return fail("REQUEST_WORKFLOW_BACKEND_DISABLED", "Trusted workflow execution is not configured.");
  }
  let authorized: Awaited<ReturnType<Resolver>>;
  try { authorized = await (deps.resolveActor ?? resolveStaffActor)(workspaceSlug); }
  catch { return fail("REQUEST_WORKFLOW_AUTH_UNAVAILABLE", "Workspace authorization could not be verified."); }
  if (!authorized.ok) return fail("REQUEST_WORKFLOW_AUTH_REQUIRED", "Sign in to process saved requests.");
  const { workspace, actor, branchScope, service, rpc } = authorized.value;
  if (actor.role !== "OWNER" || !actor.userId ||
      actor.workspaceId !== workspace.id || workspace.slug !== workspaceSlug) {
    return fail("REQUEST_WORKFLOW_OWNER_REQUIRED", "An active owner of this workspace is required.");
  }

  const req = await service.from("requests")
    .select("id,workspace_id,branch_id,service_id,customer_id")
    .eq("id", requestId).eq("workspace_id", workspace.id).maybeSingle();
  if (req.error) return fail("REQUEST_WORKFLOW_READ_FAILED", "Saved request could not be read.");
  const row = req.data;
  if (!row || row.id !== requestId) return fail("REQUEST_WORKFLOW_NOT_FOUND", "Request is unavailable.");

  const branchId = row.branch_id;
  if (!isUuid(branchId) ||
      !branchScope.branches.some(branch => branch.id === branchId) ||
      (branchScope.mode === "BRANCH" && branchScope.selectedBranchId !== branchId)) {
    return fail("REQUEST_WORKFLOW_BRANCH_FORBIDDEN", "This branch is outside your current scope.");
  }

  const branchRead = await service.from("workspace_branches")
    .select("id,code").eq("id", branchId).eq("workspace_id", workspace.id).maybeSingle();
  if (branchRead.error || !branchRead.data) {
    return fail("REQUEST_WORKFLOW_BRANCH_MISSING", "Source branch was not verified.");
  }

  let serviceCode = "";
  if (row.service_id) {
    const catalog = await service.from("service_catalog")
      .select("code").eq("id", row.service_id).eq("workspace_id", workspace.id).maybeSingle();
    if (catalog.error) return fail("REQUEST_WORKFLOW_CATALOG_READ_FAILED", "Service catalog unavailable.");
    serviceCode = safeCode(catalog.data?.code);
  }

  let leadSource = "";
  if (row.customer_id) {
    const customer = await service.from("customers")
      .select("lead_source").eq("id", row.customer_id).eq("workspace_id", workspace.id).maybeSingle();
    if (customer.error) return fail("REQUEST_WORKFLOW_CUSTOMER_READ_FAILED", "Customer source unavailable.");
    leadSource = safeCode(customer.data?.lead_source);
  }

  const ruleRead = await service.from("workflow_rules")
    .select("id,published_version_number")
    .eq("workspace_id", workspace.id).eq("branch_id", branchId)
    .eq("status", "ACTIVE").limit(21);
  if (ruleRead.error || !ruleRead.data) {
    return fail("REQUEST_WORKFLOW_RULES_UNAVAILABLE", "Published rules could not be loaded.");
  }
  if (ruleRead.data.length > 20) {
    return fail("REQUEST_WORKFLOW_RULE_LIMIT", "Too many active rules for one controlled execution.");
  }
  const port = deps.portFactory?.(rpc) ?? new PostgresWorkflowExecutionPort(rpc);
  let matchedExecutions = 0;
  let newlyRecordedRuleExecutions = 0;
  let reusedRuleExecutions = 0;
  let completedAttentionActions = 0;
  let externalApprovalRequired = 0;

  for (const rule of ruleRead.data) {
    if (!Number.isInteger(rule.published_version_number)) continue;
    const versionRead = await service.from("workflow_rule_versions")
      .select("id,rule_id,branch_id,version_number,state,event_type,conditions,actions,max_actions_per_event,created_at")
      .eq("workspace_id", workspace.id).eq("branch_id", branchId)
      .eq("rule_id", rule.id).eq("version_number", rule.published_version_number)
      .eq("state", "PUBLISHED").maybeSingle();
    if (versionRead.error) return fail("REQUEST_WORKFLOW_VERSION_READ_FAILED", "Published version could not be verified.");
    const version = versionRead.data;
    if (!version || version.event_type !== "REQUEST_CREATED") continue;
    if (!Array.isArray(version.conditions) || !Array.isArray(version.actions)) {
      return fail("REQUEST_WORKFLOW_VERSION_INVALID", "Published rule definition is invalid.");
    }

    const dto: WorkflowRuleVersionDTO = {
      id: String(version.id),
      workspaceId: workspace.id,
      branchId,
      ruleId: String(rule.id),
      versionNumber: Number(version.version_number),
      state: "PUBLISHED",
      eventType: "REQUEST_CREATED",
      conditions: version.conditions as WorkflowRuleVersionDTO["conditions"],
      actions: version.actions as WorkflowRuleVersionDTO["actions"],
      maxActionsPerEvent: Number(version.max_actions_per_event),
      createdAt: String(version.created_at),
    };
    const recorded = await port.evaluateAndRecord({
      version: dto,
      mode: "LIVE",
      event: {
        workspaceId: workspace.id,
        branchId,
        eventType: "REQUEST_CREATED",
        sourceEventId: requestId,
        snapshot: {
          "request.serviceCode": serviceCode,
          "request.leadSource": leadSource,
          "request.branchCode": safeCode(branchRead.data.code),
        },
        recursionDepth: 0,
      },
    });
    if (!recorded.ok) return fail("REQUEST_WORKFLOW_EXECUTION_FAILED", "Workflow execution was not verified.");
    if (recorded.value.duplicate) {
      // A retry must not re-evaluate a mutable customer request as if it
      // were a new REQUEST_CREATED event. The DB's immutable first event
      // snapshot is authoritative; refuse drift before acting on its queue.
      const existing = await service.from("workflow_executions")
        .select("event_fingerprint,matched,rule_version_id")
        .eq("id", recorded.value.executionId)
        .eq("workspace_id", workspace.id)
        .eq("branch_id", branchId)
        .maybeSingle();
      if (existing.error || !existing.data) {
        return fail("REQUEST_WORKFLOW_PREVIOUS_EXECUTION_MISSING", "Previously recorded event could not be verified.");
      }
      if (existing.data.rule_version_id !== version.id ||
          existing.data.event_fingerprint !== recorded.value.plan.eventFingerprint ||
          existing.data.matched !== recorded.value.plan.matched) {
        return fail("REQUEST_WORKFLOW_EVENT_DRIFT", "The request facts changed after this event was recorded. Review the original execution before retrying.");
      }
    }
    if (recorded.value.duplicate) {
      reusedRuleExecutions++;
    } else {
      newlyRecordedRuleExecutions++;
    }
    if (!recorded.value.plan.matched) continue;
    matchedExecutions++;
    externalApprovalRequired += recorded.value.plan.actionPlans
      .filter(action => action.requiresOwnerApproval).length;

    const pending = await service.from("workflow_action_executions")
      .select("id,action_type,state").eq("workspace_id", workspace.id)
      .eq("branch_id", branchId)
      .eq("execution_id", recorded.value.executionId)
      .eq("action_type", "CREATE_ATTENTION").eq("state", "PENDING").limit(6);
    if (pending.error || !pending.data) {
      return fail("REQUEST_WORKFLOW_ACTION_READ_FAILED", "Pending internal actions could not be verified.");
    }
    for (const action of pending.data) {
      const applied = await port.executeAttentionAction(workspace.id, String(action.id));
      if (!applied.ok) {
        return fail("REQUEST_WORKFLOW_ATTENTION_FAILED", "Internal attention action failed; inspect the execution log.");
      }
      const proof = await service.from("attention_items")
        .select("id").eq("id", applied.value.attentionItemId)
        .eq("workspace_id", workspace.id).maybeSingle();
      if (proof.error || proof.data?.id !== applied.value.attentionItemId) {
        return fail("REQUEST_WORKFLOW_ATTENTION_UNVERIFIED", "Attention was not readable after execution.");
      }
      completedAttentionActions++;
    }
  }

  return { ok: true, value: {
    state: "PERSISTED_INTERNAL_WORKFLOW_PROCESSING",
    requestId,
    matchedExecutions,
    completedAttentionActions,
    externalApprovalRequired,
    providerMessagesSent: 0,
    replayedSourceEvent: reusedRuleExecutions > 0,
    newlyRecordedRuleExecutions,
    reusedRuleExecutions,
  } };
}
