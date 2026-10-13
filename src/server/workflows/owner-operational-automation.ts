import type { Result, WorkflowEventType, WorkflowRuleVersionDTO } from "../../contracts";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { PostgresWorkflowExecutionPort } from "./postgres";
import { MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH, WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT } from "./automation-limits";
import { isVerifiedPaidInvoiceMilestone } from "./paid-invoice-milestone";
import type { WorkflowEventEnvelope } from "./engine";

export type OwnerOperationalEventType = Extract<WorkflowEventType,
  "QUOTE_ACCEPTED" | "VISIT_COMPLETED" | "INVOICE_PAID" | "ATTENTION_OPENED">;
type Resolver = typeof resolveStaffActor;

export interface OwnerOperationalAutomationDependencies {
  resolveActor?: Resolver;
  mode?: typeof operationalDatabaseMode;
  portFactory?: (rpc: ConstructorParameters<typeof PostgresWorkflowExecutionPort>[0]) =>
    Pick<PostgresWorkflowExecutionPort, "evaluateAndRecord" | "executeAttentionAction">;
}
export interface OwnerOperationalAutomationReceipt {
  state: "PERSISTED_INTERNAL_WORKFLOW_PROCESSING";
  eventType: OwnerOperationalEventType;
  sourceId: string;
  matchedExecutions: number;
  completedAttentionActions: number;
  externalApprovalRequired: number;
  newlyRecordedRuleExecutions: number;
  reusedRuleExecutions: number;
  providerMessagesSent: 0;
}
function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function code(v: unknown): string {
  return typeof v === "string" && /^[a-z0-9_-]{1,64}$/i.test(v) ? v : "";
}

/**
 * Owner-initiated execution of persisted business milestone events.
 * This does not automatically subscribe to database changes, dispatch
 * providers, transition jobs, approve money, or cascade attention events.
 * Only a published, branch-scoped internal CREATE_ATTENTION is applied.
 */
export async function runOwnerSavedOperationalAutomation(
  workspaceSlug: string,
  eventType: OwnerOperationalEventType,
  sourceId: string,
  deps: OwnerOperationalAutomationDependencies = {},
): Promise<Result<OwnerOperationalAutomationReceipt>> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug) ||
      workspaceSlug.length > 40 || workspaceSlug.length < 3 ||
      !uuid(sourceId) || !["QUOTE_ACCEPTED","VISIT_COMPLETED","INVOICE_PAID","ATTENTION_OPENED"].includes(eventType)) {
    return fail("OPERATIONAL_AUTOMATION_INPUT_INVALID", "Select a valid saved operational event.");
  }
  if ((deps.mode ?? operationalDatabaseMode)() !== "SERVICE_ROLE") {
    return fail("OPERATIONAL_AUTOMATION_TRUSTED_BACKEND_REQUIRED",
      "Trusted database workflow execution is not configured.");
  }
  let verified: Awaited<ReturnType<Resolver>>;
  try { verified = await (deps.resolveActor ?? resolveStaffActor)(workspaceSlug); }
  catch { return fail("OPERATIONAL_AUTOMATION_AUTH_UNAVAILABLE", "Workspace authorization could not be verified."); }
  if (!verified.ok) return fail("OPERATIONAL_AUTOMATION_AUTH_REQUIRED", "Sign in as an owner.");
  const { workspace, actor, branchScope, service, rpc } = verified.value;
  if (workspace.slug !== workspaceSlug || !actor.userId ||
      actor.role !== "OWNER" || actor.workspaceId !== workspace.id) {
    return fail("OPERATIONAL_AUTOMATION_OWNER_REQUIRED", "An active workspace owner is required.");
  }

  let requestId: string | null = null;
  let branchId: string | null = null;
  let sourceServiceCode = "";
  let currency = "";
  let attentionType = "";
  let attentionSeverity = "";
  if (eventType === "QUOTE_ACCEPTED") {
    const row = await service.from("quotes")
      .select("id,request_id,status,currency,service_code")
      .eq("id",sourceId).eq("workspace_id",workspace.id).maybeSingle();
    if (row.error) return fail("OPERATIONAL_AUTOMATION_SOURCE_UNAVAILABLE","Saved quote could not be read.");
    if (!row.data) return fail("OPERATIONAL_AUTOMATION_NOT_FOUND","Quote is not in this workspace.");
    if (row.data.status !== "ACCEPTED" || !uuid(row.data.request_id)) {
      return fail("OPERATIONAL_AUTOMATION_SOURCE_NOT_READY","Only accepted persisted quotes can be processed.");
    }
    requestId = row.data.request_id;
    currency = code(String(row.data.currency ?? "").trim());
    sourceServiceCode = code(row.data.service_code);
  } else if (eventType === "VISIT_COMPLETED") {
    const row = await service.from("visits")
      .select("id,request_id,branch_id,status")
      .eq("id",sourceId).eq("workspace_id",workspace.id).maybeSingle();
    if (row.error) return fail("OPERATIONAL_AUTOMATION_SOURCE_UNAVAILABLE","Saved visit could not be read.");
    if (!row.data) return fail("OPERATIONAL_AUTOMATION_NOT_FOUND","Visit is not in this workspace.");
    if (row.data.status !== "COMPLETED" || !uuid(row.data.request_id) || !uuid(row.data.branch_id)) {
      return fail("OPERATIONAL_AUTOMATION_SOURCE_NOT_READY","Only completed persisted visits can be processed.");
    }
    requestId = row.data.request_id;
    branchId = row.data.branch_id;
  } else if (eventType === "INVOICE_PAID") {
    const row = await service.from("invoices")
      .select("id,quote_id,status,currency,total_minor,allocated_minor,refunded_minor,balance_minor")
      .eq("id",sourceId).eq("workspace_id",workspace.id).maybeSingle();
    if (row.error) return fail("OPERATIONAL_AUTOMATION_SOURCE_UNAVAILABLE","Saved invoice could not be read.");
    if (!row.data) return fail("OPERATIONAL_AUTOMATION_NOT_FOUND","Invoice is not in this workspace.");
    if (!uuid(row.data.quote_id) || !isVerifiedPaidInvoiceMilestone(row.data)) {
      return fail("OPERATIONAL_AUTOMATION_SOURCE_NOT_READY",
        "Only fully paid invoices with a verified, refund-adjusted ledger can trigger owner workflows.");
    }
    currency = code(String(row.data.currency ?? "").trim());
    const quote = await service.from("quotes")
      .select("request_id,service_code,status,currency").eq("id",row.data.quote_id)
      .eq("workspace_id",workspace.id).maybeSingle();
    if (quote.error || !quote.data || !uuid(quote.data.request_id) ||
        quote.data.status !== "ACCEPTED" || quote.data.currency !== row.data.currency) {
      return fail("OPERATIONAL_AUTOMATION_QUOTE_UNVERIFIED",
        "The paid invoice quote, acceptance or currency could not be reconciled.");
    }
    requestId = quote.data.request_id;
    sourceServiceCode = code(quote.data.service_code);
  } else {
    // A generic attention item does not have a branch_id. Only source-linked
    // request exceptions have a provable branch. Exclude workflow-generated
    // attention items and all other unsupported resource mappings to prevent
    // recursion and arbitrary cross-branch escalation.
    const row = await service.from("attention_items")
      .select("id,status,type,severity,resource_type,resource_id")
      .eq("id",sourceId).eq("workspace_id",workspace.id).maybeSingle();
    if (row.error) return fail("OPERATIONAL_AUTOMATION_SOURCE_UNAVAILABLE","Saved attention item could not be read.");
    if (!row.data) return fail("OPERATIONAL_AUTOMATION_NOT_FOUND","Attention item is not in this workspace.");
    if (row.data.status !== "OPEN" ||
        typeof row.data.resource_type !== "string" ||
        row.data.resource_type.toLowerCase() !== "request" ||
        !uuid(row.data.resource_id)) {
      return fail("OPERATIONAL_AUTOMATION_SOURCE_NOT_READY",
        "Only open request-linked attention items can be processed; workflow-generated items cannot recurse.");
    }
    if (!["INFO","WARNING","CRITICAL"].includes(String(row.data.severity))) {
      return fail("OPERATIONAL_AUTOMATION_SOURCE_INVALID","Attention severity was not verified.");
    }
    requestId = row.data.resource_id;
    attentionType = code(row.data.type);
    attentionSeverity = String(row.data.severity);
    if (!attentionType) return fail("OPERATIONAL_AUTOMATION_SOURCE_INVALID","Attention type was not verified.");
  }

  // Always verify the actual persisted request to derive tenant/branch
  // authority, rather than trusting a snapshot or a form-submitted branch.
  const req = await service.from("requests")
    .select("id,branch_id,service_id").eq("id",requestId)
    .eq("workspace_id",workspace.id).maybeSingle();
  if (req.error || !req.data || !uuid(req.data.branch_id)) {
    return fail("OPERATIONAL_AUTOMATION_REQUEST_UNVERIFIED","The linked cleaning request was not verified.");
  }
  if (branchId && req.data.branch_id !== branchId) {
    return fail("OPERATIONAL_AUTOMATION_BRANCH_DRIFT","The visit and request branch disagree.");
  }
  branchId = req.data.branch_id;
  if (!branchScope.branches.some(branch => branch.id === branchId) ||
      (branchScope.mode === "BRANCH" && branchScope.selectedBranchId !== branchId)) {
    return fail("OPERATIONAL_AUTOMATION_BRANCH_FORBIDDEN","The source event is outside this owner's selected branch.");
  }
  let serviceCode = sourceServiceCode;
  if (req.data.service_id != null) {
    if (!uuid(req.data.service_id)) return fail("OPERATIONAL_AUTOMATION_CATALOG_UNVERIFIED","Invalid request service reference.");
    const catalog = await service.from("service_catalog")
      .select("code").eq("id",req.data.service_id).eq("workspace_id",workspace.id).maybeSingle();
    if (catalog.error || !catalog.data) return fail("OPERATIONAL_AUTOMATION_CATALOG_UNVERIFIED","Stored service code was not verified.");
    if (sourceServiceCode && sourceServiceCode !== code(catalog.data.code)) {
      return fail("OPERATIONAL_AUTOMATION_SERVICE_DRIFT","Quote and request disagree on the configured cleaning service.");
    }
    serviceCode = code(catalog.data.code);
  }
  const b = await service.from("workspace_branches")
    .select("code").eq("id",branchId).eq("workspace_id",workspace.id).maybeSingle();
  if (b.error || !b.data) return fail("OPERATIONAL_AUTOMATION_BRANCH_UNVERIFIED","Saved branch is unavailable.");
  const branchCode = code(b.data.code);
  let snapshot: WorkflowEventEnvelope["snapshot"];
  if (eventType === "QUOTE_ACCEPTED") {
    snapshot = { "quote.currency": currency, "quote.branchCode": branchCode, "request.serviceCode": serviceCode };
  } else if (eventType === "VISIT_COMPLETED") {
    // A visit can contain freeform media, crew notes and customer contact
    // data. None of these may enter a workflow event. A verified incident
    // signal would require an explicit durable quality finding; omit the
    // field entirely rather than inventing a false "no incident" flag.
    snapshot = { "visit.branchCode": branchCode, "request.serviceCode": serviceCode };
  } else if (eventType === "INVOICE_PAID") {
    snapshot = { "invoice.currency": currency, "invoice.branchCode": branchCode, "request.serviceCode": serviceCode };
  } else {
    snapshot = { "attention.type": attentionType, "attention.severity": attentionSeverity,
      "attention.branchCode": branchCode };
  }

  const rules = await service.from("workflow_rules")
    .select("id,published_version_number").eq("workspace_id",workspace.id)
    .eq("branch_id",branchId).eq("status","ACTIVE").limit(WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT);
  if (rules.error || !rules.data) return fail("OPERATIONAL_AUTOMATION_RULES_UNAVAILABLE","Published rules could not be read.");
  if (rules.data.length > MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH) return fail("OPERATIONAL_AUTOMATION_RULE_LIMIT","Too many active rules for one controlled event.");
  const port = deps.portFactory?.(rpc) ?? new PostgresWorkflowExecutionPort(rpc);
  let matchedExecutions=0,completedAttentionActions=0,externalApprovalRequired=0,
      newlyRecordedRuleExecutions=0,reusedRuleExecutions=0;
  for (const rule of rules.data) {
    if (!Number.isInteger(rule.published_version_number)) continue;
    const loaded = await service.from("workflow_rule_versions")
      .select("id,rule_id,branch_id,version_number,state,event_type,conditions,actions,max_actions_per_event,created_at")
      .eq("workspace_id",workspace.id).eq("branch_id",branchId)
      .eq("rule_id",rule.id).eq("version_number",rule.published_version_number)
      .eq("state","PUBLISHED").maybeSingle();
    if (loaded.error) return fail("OPERATIONAL_AUTOMATION_VERSION_UNAVAILABLE","Published version could not be read.");
    const version=loaded.data;
    if (!version || version.event_type !== eventType) continue;
    if (!Array.isArray(version.conditions) || !Array.isArray(version.actions)) {
      return fail("OPERATIONAL_AUTOMATION_VERSION_INVALID","Published rule definition is invalid.");
    }
    const dto: WorkflowRuleVersionDTO = {
      id: String(version.id),workspaceId:workspace.id,branchId,ruleId:String(rule.id),
      versionNumber:Number(version.version_number),state:"PUBLISHED",eventType,
      conditions:version.conditions as WorkflowRuleVersionDTO["conditions"],
      actions:version.actions as WorkflowRuleVersionDTO["actions"],
      maxActionsPerEvent:Number(version.max_actions_per_event),
      createdAt:String(version.created_at),
    };
    const result=await port.evaluateAndRecord({
      version:dto,mode:"LIVE",
      event:{workspaceId:workspace.id,branchId,eventType,sourceEventId:sourceId,snapshot,recursionDepth:0},
    });
    if (!result.ok) return fail("OPERATIONAL_AUTOMATION_EXECUTION_FAILED","Durable workflow execution could not be verified.");
    if (result.value.duplicate) {
      const old=await service.from("workflow_executions")
        .select("rule_version_id,event_fingerprint,matched")
        .eq("id",result.value.executionId).eq("workspace_id",workspace.id)
        .eq("branch_id",branchId).maybeSingle();
      if (old.error || !old.data || old.data.rule_version_id !== version.id ||
          old.data.event_fingerprint !== result.value.plan.eventFingerprint ||
          old.data.matched !== result.value.plan.matched) {
        return fail("OPERATIONAL_AUTOMATION_EVENT_DRIFT","The source event facts changed after recording; review its original execution.");
      }
      reusedRuleExecutions++;
    } else newlyRecordedRuleExecutions++;
    if (!result.value.plan.matched) continue;
    matchedExecutions++;
    externalApprovalRequired += result.value.plan.actionPlans.filter(x=>x.requiresOwnerApproval).length;
    const pending=await service.from("workflow_action_executions")
      .select("id").eq("workspace_id",workspace.id).eq("branch_id",branchId)
      .eq("execution_id",result.value.executionId)
      .eq("action_type","CREATE_ATTENTION").eq("state","PENDING").limit(6);
    if (pending.error || !pending.data) return fail("OPERATIONAL_AUTOMATION_ACTION_UNVERIFIED","Pending internal actions could not be read.");
    for (const action of pending.data) {
      const applied=await port.executeAttentionAction(workspace.id,String(action.id));
      if (!applied.ok) return fail("OPERATIONAL_AUTOMATION_ATTENTION_FAILED","Internal attention action could not be saved.");
      const proof=await service.from("attention_items").select("id")
        .eq("id",applied.value.attentionItemId).eq("workspace_id",workspace.id).maybeSingle();
      if (proof.error || proof.data?.id !== applied.value.attentionItemId) {
        return fail("OPERATIONAL_AUTOMATION_ATTENTION_UNVERIFIED","Saved attention item could not be read back.");
      }
      completedAttentionActions++;
    }
  }
  return {ok:true,value:{
    state:"PERSISTED_INTERNAL_WORKFLOW_PROCESSING",eventType,sourceId,
    matchedExecutions,completedAttentionActions,externalApprovalRequired,
    newlyRecordedRuleExecutions,reusedRuleExecutions,providerMessagesSent:0,
  }};
}
