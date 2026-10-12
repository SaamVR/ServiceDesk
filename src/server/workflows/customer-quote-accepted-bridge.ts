import type { SupabaseClient } from "@supabase/supabase-js";
import type { Result, WorkflowRuleVersionDTO } from "../../contracts";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";
import { PostgresWorkflowExecutionPort } from "./postgres";
import { workspaceQuoteAutomationEnabled } from "./owner-quote-automation-setting";
import {
  MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH,
  WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT,
} from "./automation-limits";

const isUuid = (v: unknown): v is string => typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const safeCode = (v: unknown): string =>
  typeof v === "string" && /^[a-z0-9_-]{1,64}$/i.test(v) ? v : "";
function fail(code: string): Result<never> {
  return { ok: false, code, message: "Internal follow-up was not verified. Staff may retry the published rule from Studio." };
}

export interface TrustedQuoteAcceptedSource {
  workspaceId: string;
  customerId: string;
  quoteId: string;
  /** Server-created service-role client, NEVER passed from a browser. */
  service: SupabaseClient;
  rpc: SupabaseRpcClient;
}
export interface TrustedQuoteFollowUpReceipt {
  state: "PERSISTED_INTERNAL_QUOTE_ACCEPTED_AUTOMATION";
  newlyRecordedRuleExecutions: number;
  reusedRuleExecutions: number;
  completedAttentionActions: number;
  approvalRequired: number;
  providerMessagesSent: 0;
}
export interface TrustedQuoteFollowUpDeps {
  portFactory?: (rpc: SupabaseRpcClient) =>
    Pick<PostgresWorkflowExecutionPort, "evaluateAndRecord" | "executeAttentionAction">;
}

/**
 * Called only AFTER the authenticated customer acceptance RPC returned an
 * accepted quote. This is not a public RPC and accepts no submitted form
 * branch, service, customer contact, or workflow action.
 *
 * Each source fact is re-read using the session-authorized customer ID. Only
 * owner-PUBLISHED rules can create internal attention. Outbound templates
 * remain APPROVAL_REQUIRED, never sent by a customer acceptance.
 * The source event identity is the immutable saved quote ID: replay is
 * deduplicated by the transactional workflow engine.
 *
 * This post-accept bridge is best effort, not a transactional outbox. The
 * customer acceptance must not be undone because a later internal attention
 * write fails; staff can retry from the persisted accepted-quote milestone.
 */
export async function runTrustedAcceptedQuoteInternalAutomation(
  input: TrustedQuoteAcceptedSource,
  deps: TrustedQuoteFollowUpDeps = {},
): Promise<Result<TrustedQuoteFollowUpReceipt>> {
  const { workspaceId, customerId, quoteId, service, rpc } = input;
  if (!isUuid(workspaceId) || !isUuid(customerId) || !isUuid(quoteId)) {
    return fail("QUOTE_AUTOMATION_SOURCE_INVALID");
  }
  // Server-wide kill switch is necessary but not sufficient for a shared SaaS:
  // the authenticated owner's persisted tenant flag must also explicitly opt in.
  if (!await workspaceQuoteAutomationEnabled(service, workspaceId)) {
    return fail("QUOTE_AUTOMATION_WORKSPACE_NOT_OPTED_IN");
  }

  const quote = await service.from("quotes")
    .select("id,request_id,status,currency,service_code")
    .eq("id", quoteId).eq("workspace_id", workspaceId).maybeSingle();
  if (quote.error || !quote.data || quote.data.status !== "ACCEPTED" ||
      !isUuid(quote.data.request_id)) return fail("QUOTE_AUTOMATION_QUOTE_UNVERIFIED");

  const request = await service.from("requests")
    .select("id,branch_id,customer_id,service_id")
    .eq("id", quote.data.request_id).eq("workspace_id", workspaceId)
    .eq("customer_id", customerId).maybeSingle();
  if (request.error || !request.data || !isUuid(request.data.branch_id) ||
      request.data.customer_id !== customerId) {
    return fail("QUOTE_AUTOMATION_CUSTOMER_SCOPE_INVALID");
  }
  const branchId: string = request.data.branch_id;
  const branch = await service.from("workspace_branches")
    .select("code,currency,active").eq("id", branchId)
    .eq("workspace_id", workspaceId).maybeSingle();
  if (branch.error || !branch.data || branch.data.active !== true ||
      !safeCode(branch.data.code) ||
      typeof branch.data.currency !== "string" ||
      branch.data.currency.trim() !== quote.data.currency) {
    return fail("QUOTE_AUTOMATION_BRANCH_UNVERIFIED");
  }

  let serviceCode = safeCode(quote.data.service_code);
  if (request.data.service_id != null) {
    if (!isUuid(request.data.service_id)) return fail("QUOTE_AUTOMATION_CATALOG_UNVERIFIED");
    const catalog = await service.from("service_catalog")
      .select("code,active").eq("id", request.data.service_id)
      .eq("workspace_id", workspaceId).maybeSingle();
    if (catalog.error || !catalog.data || catalog.data.active !== true ||
        !safeCode(catalog.data.code) ||
        (serviceCode && serviceCode !== catalog.data.code)) {
      return fail("QUOTE_AUTOMATION_CATALOG_UNVERIFIED");
    }
    serviceCode = catalog.data.code;
  }
  if (!serviceCode) return fail("QUOTE_AUTOMATION_SERVICE_UNVERIFIED");

  const rules = await service.from("workflow_rules")
    .select("id,published_version_number")
    .eq("workspace_id", workspaceId).eq("branch_id", branchId)
    .eq("status","ACTIVE").limit(WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT);
  if (rules.error || !rules.data ||
      rules.data.length > MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH) {
    return fail("QUOTE_AUTOMATION_RULES_UNAVAILABLE");
  }

  const port = deps.portFactory?.(rpc) ?? new PostgresWorkflowExecutionPort(rpc);
  let newlyRecordedRuleExecutions = 0, reusedRuleExecutions = 0,
      completedAttentionActions = 0, approvalRequired = 0;
  for (const rule of rules.data) {
    if (!Number.isInteger(rule.published_version_number)) continue;
    const versionResult = await service.from("workflow_rule_versions")
      .select("id,rule_id,branch_id,version_number,state,event_type,conditions,actions,max_actions_per_event,created_at")
      .eq("workspace_id", workspaceId).eq("branch_id", branchId)
      .eq("rule_id", rule.id).eq("version_number", rule.published_version_number)
      .eq("state","PUBLISHED").maybeSingle();
    if (versionResult.error) return fail("QUOTE_AUTOMATION_RULE_VERSION_UNAVAILABLE");
    const version = versionResult.data;
    if (!version || version.event_type !== "QUOTE_ACCEPTED") continue;
    if (!Array.isArray(version.actions) || !Array.isArray(version.conditions)) {
      return fail("QUOTE_AUTOMATION_RULE_VERSION_INVALID");
    }
    const dto: WorkflowRuleVersionDTO = {
      id: String(version.id), workspaceId, branchId,
      ruleId: String(rule.id), versionNumber: Number(version.version_number),
      state:"PUBLISHED",eventType:"QUOTE_ACCEPTED",
      actions:version.actions as WorkflowRuleVersionDTO["actions"],
      conditions:version.conditions as WorkflowRuleVersionDTO["conditions"],
      maxActionsPerEvent:Number(version.max_actions_per_event),
      createdAt:String(version.created_at),
    };
    const saved = await port.evaluateAndRecord({
      version:dto, mode:"LIVE",
      event:{workspaceId,branchId,eventType:"QUOTE_ACCEPTED",
        sourceEventId:quoteId,recursionDepth:0,
        snapshot:{"quote.currency":String(quote.data.currency),
          "quote.branchCode":safeCode(branch.data.code),
          "request.serviceCode":serviceCode}},
    });
    if (!saved.ok) return fail("QUOTE_AUTOMATION_EXECUTION_NOT_VERIFIED");
    if (saved.value.duplicate) {
      const proof = await service.from("workflow_executions")
        .select("rule_version_id,event_fingerprint,matched")
        .eq("id",saved.value.executionId).eq("workspace_id",workspaceId)
        .eq("branch_id",branchId).maybeSingle();
      if (proof.error || !proof.data ||
          proof.data.rule_version_id !== dto.id ||
          proof.data.event_fingerprint !== saved.value.plan.eventFingerprint ||
          proof.data.matched !== saved.value.plan.matched) {
        return fail("QUOTE_AUTOMATION_REPLAY_DRIFT");
      }
      reusedRuleExecutions++;
    } else newlyRecordedRuleExecutions++;

    if (!saved.value.plan.matched) continue;
    approvalRequired += saved.value.plan.actionPlans.filter(p => p.requiresOwnerApproval).length;
    const pending = await service.from("workflow_action_executions")
      .select("id").eq("workspace_id",workspaceId).eq("branch_id",branchId)
      .eq("execution_id",saved.value.executionId)
      .eq("action_type","CREATE_ATTENTION").eq("state","PENDING").limit(6);
    if (pending.error || !pending.data) return fail("QUOTE_AUTOMATION_PENDING_UNAVAILABLE");
    for (const action of pending.data) {
      if (!isUuid(action.id)) return fail("QUOTE_AUTOMATION_ACTION_INVALID");
      const applied = await port.executeAttentionAction(workspaceId, action.id);
      if (!applied.ok || !isUuid(applied.value.attentionItemId)) {
        return fail("QUOTE_AUTOMATION_ATTENTION_NOT_SAVED");
      }
      const persisted = await service.from("attention_items")
        .select("id").eq("id",applied.value.attentionItemId)
        .eq("workspace_id",workspaceId).maybeSingle();
      if (persisted.error || persisted.data?.id !== applied.value.attentionItemId) {
        return fail("QUOTE_AUTOMATION_ATTENTION_UNVERIFIED");
      }
      completedAttentionActions++;
    }
  }
  return {ok:true,value:{
    state:"PERSISTED_INTERNAL_QUOTE_ACCEPTED_AUTOMATION",
    newlyRecordedRuleExecutions,reusedRuleExecutions,
    completedAttentionActions,approvalRequired,providerMessagesSent:0,
  }};
}
