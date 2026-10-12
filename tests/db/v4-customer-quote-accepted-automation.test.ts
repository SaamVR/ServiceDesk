import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import {
  runTrustedAcceptedQuoteInternalAutomation,
  type TrustedQuoteFollowUpDeps,
} from "../../src/server/workflows/customer-quote-accepted-bridge";

const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const customer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const quote = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const request = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const branch = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const serviceId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const actionId = "11111111-1111-4111-8111-111111111111";
const attentionId = "22222222-2222-4222-8222-222222222222";
const versionId = "33333333-3333-4333-8333-333333333333";
const executionId = "44444444-4444-4444-8444-444444444444";

function fixture(options: {
  customerId?: string;
  sourceStatus?: string;
  foreignWorkspace?: boolean;
  inactiveBranch?: boolean;
  mismatchCurrency?: boolean;
  mismatchService?: boolean;
  duplicate?: boolean;
  drift?: boolean;
  noRules?: boolean;
  wrongEvent?: boolean;
  pending?: boolean;
  failedAttention?: boolean;
  missingAttention?: boolean;
  externalOnly?: boolean;
  workspaceOptedOut?: boolean;
  deploymentOff?: boolean;
}={}) {
  let pending = options.pending ?? true;
  const rows: Record<string,Record<string,unknown>[]> = {
    workspace_feature_flags: options.workspaceOptedOut ? [] : [{
      workspace_id: workspace, feature_key: "AUTO_INTERNAL_QUOTE_ACCEPTED", enabled: true,
    }],
    quotes:[{id:quote,workspace_id:options.foreignWorkspace?"other-tenant":workspace,
      request_id:request,status:options.sourceStatus??"ACCEPTED",currency:"USD",service_code:"MOVE_OUT"}],
    requests:[{id:request,workspace_id:workspace,branch_id:branch,
      customer_id:options.customerId??customer,service_id:serviceId}],
    workspace_branches:[{id:branch,workspace_id:workspace,code:"MAIN",
      currency:options.mismatchCurrency?"GBP":"USD",active:!options.inactiveBranch}],
    service_catalog:[{id:serviceId,workspace_id:workspace,
      code:options.mismatchService?"DEEP":"MOVE_OUT",active:true}],
    workflow_rules:options.noRules?[]:[{id:"rule-1",workspace_id:workspace,
      branch_id:branch,status:"ACTIVE",published_version_number:1}],
    workflow_rule_versions:[{id:versionId,rule_id:"rule-1",branch_id:branch,
      workspace_id:workspace,version_number:1,state:"PUBLISHED",
      event_type:options.wrongEvent?"REQUEST_CREATED":"QUOTE_ACCEPTED",conditions:[],actions:[
        {type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"DISPATCH_REVIEW"},
        {type:"SEND_EMAIL_TEMPLATE",templateKey:"quote-follow-up",recipient:"CUSTOMER_PRIMARY"}],
      max_actions_per_event:3,created_at:"2026-10-12T01:00:00.000Z"}],
    workflow_executions:[{id:executionId,rule_version_id:versionId,
      workspace_id:workspace,branch_id:branch,matched:true,
      event_fingerprint:options.drift?"different-snapshot":"current-fingerprint"}],
    workflow_action_executions: options.missingAttention ? [] : [{id:actionId,
      workspace_id:workspace,branch_id:branch,execution_id:executionId,
      action_type:"CREATE_ATTENTION",action_index:0,
      state: options.failedAttention ? "FAILED" : pending ? "PENDING" : "SUCCEEDED"}],
    attention_items:[{id:attentionId,workspace_id:workspace}],
  };
  const seen: Array<{table:string; filters:[string,unknown][]}> = [];
  const service = {from(table:string) {
    const filters:Array<[string,unknown]> = [];
    seen.push({table,filters});
    const match=()=> (rows[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v));
    const q={
      select(){return q;},
      eq(k:string,v:unknown){filters.push([k,v]);return q;},
      maybeSingle:async()=>({data:match()[0]??null,error:null}),
      limit:async(n:number)=>({data:match().slice(0,n),error:null}),
    };
    return q;
  }} as unknown as SupabaseClient;
  const evaluateAndRecord=vi.fn(async (input:{
    mode:string;
    event:{sourceEventId:string;eventType:string;snapshot:Record<string,unknown>};
  })=>{
    expect(input.mode).toBe("LIVE");
    expect(input.event.sourceEventId).toBe(quote);
    expect(input.event.eventType).toBe("QUOTE_ACCEPTED");
    expect(input.event.snapshot).toEqual({
      "quote.currency":"USD","quote.branchCode":"MAIN","request.serviceCode":"MOVE_OUT",
    });
    return {ok:true as const,value:{executionId,
      duplicate:options.duplicate??false,
      plan:{matched:true,eventFingerprint:"current-fingerprint",
        actionPlans:[{requiresOwnerApproval:false},{requiresOwnerApproval:true}]}}};
  });
  const executeAttentionAction=vi.fn(async()=>{
    pending=false;
    const saved = rows.workflow_action_executions.find(row=>row.id===actionId);
    if (saved) saved.state = "SUCCEEDED";
    return {ok:true as const,value:{attentionItemId:attentionId,actionExecutionId:actionId}};
  });
  const rpc={rpc:vi.fn()};
  return {service,rpc,seen,evaluateAndRecord,executeAttentionAction,
    input:{workspaceId:workspace,customerId:customer,quoteId:quote,
      service,rpc:rpc as unknown as SupabaseRpcClient},
    deps:{
      portFactory:()=>({evaluateAndRecord,executeAttentionAction}),
      deploymentEnabled:()=>!options.deploymentOff,
    } as unknown as TrustedQuoteFollowUpDeps};
}
describe("V4 trusted post-accept automation bridge",()=>{
  it("records the real accepted quote event and completes only persisted internal attention",async()=>{
    const t=fixture();
    expect(await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps))
      .toMatchObject({ok:true,value:{
        state:"PERSISTED_INTERNAL_QUOTE_ACCEPTED_AUTOMATION",
        newlyRecordedRuleExecutions:1,reusedRuleExecutions:0,
        completedAttentionActions:1,approvalRequired:1,providerMessagesSent:0,
      }});
    expect(t.evaluateAndRecord).toHaveBeenCalledOnce();
    expect(t.executeAttentionAction).toHaveBeenCalledWith(workspace,actionId);
    expect(t.rpc.rpc).not.toHaveBeenCalled();
  });
  it("denies foreign, unaccepted, other-customer, inactive/currency/service drift sources before recording",async()=>{
    for(const options of [
      {foreignWorkspace:true}, {sourceStatus:"SENT"}, {customerId:"other-customer"},
      {inactiveBranch:true}, {mismatchCurrency:true}, {mismatchService:true},
    ]) {
      const t=fixture(options);
      const result=await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps);
      expect(result.ok).toBe(false);
      expect(t.evaluateAndRecord).not.toHaveBeenCalled();
      expect(t.executeAttentionAction).not.toHaveBeenCalled();
    }
  });
  it("prevents internal writes when deployment is disabled, even for an opted-in tenant",async()=>{
    const t=fixture({deploymentOff:true});
    const result=await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps);
    expect(result).toMatchObject({ok:false,code:"QUOTE_AUTOMATION_DEPLOYMENT_DISABLED"});
    expect(t.seen).toHaveLength(0);
    expect(t.evaluateAndRecord).not.toHaveBeenCalled();
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
  });
  it("defaults to server-side kill switch off when no test override is supplied",async()=>{
    const t=fixture();
    const deps={portFactory:t.deps.portFactory};
    const original=process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED;
    try {
      delete process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED;
      expect(await runTrustedAcceptedQuoteInternalAutomation(t.input,deps))
        .toMatchObject({ok:false,code:"QUOTE_AUTOMATION_DEPLOYMENT_DISABLED"});
      expect(t.seen).toHaveLength(0);
    } finally {
      if(original===undefined) delete process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED;
      else process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED=original;
    }
  });
  it("never evaluates any rule for a tenant lacking its own persisted opt-in",async()=>{
    const t=fixture({workspaceOptedOut:true});
    const result=await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps);
    expect(result).toMatchObject({ok:false,code:"QUOTE_AUTOMATION_WORKSPACE_NOT_OPTED_IN"});
    expect(t.evaluateAndRecord).not.toHaveBeenCalled();
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
    expect(t.seen.some(row=>row.table==="quotes")).toBe(false);
  });
  it("returns a retryable failure when no owner-published internal quote rule can be evaluated",async()=>{
    for (const options of [{noRules:true},{wrongEvent:true}]) {
      const t=fixture(options);
      expect(await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps))
        .toMatchObject({ok:false,code:"QUOTE_AUTOMATION_NO_ELIGIBLE_PUBLISHED_RULE"});
      expect(t.evaluateAndRecord).not.toHaveBeenCalled();
      expect(t.executeAttentionAction).not.toHaveBeenCalled();
    }
  });
  it("deduplicates a prior accepted quote event and does not duplicate completed attention",async()=>{
    const t=fixture({duplicate:true,pending:false});
    expect(await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps))
      .toMatchObject({ok:true,value:{newlyRecordedRuleExecutions:0,
        reusedRuleExecutions:1,completedAttentionActions:0,providerMessagesSent:0}});
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
  });
  it("refuses to ACK a duplicate with FAILED internal attention instead of a completed receipt",async()=>{
    const t=fixture({duplicate:true,pending:false,failedAttention:true});
    expect(await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps))
      .toMatchObject({ok:false,code:"QUOTE_AUTOMATION_ATTENTION_NOT_COMPLETED"});
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
    expect(t.seen.filter(entry=>entry.table==="workflow_action_executions")).toHaveLength(2);
  });

  it("refuses to ACK a matched owner rule with no saved internal attention action",async()=>{
    const t=fixture({duplicate:true,pending:false,missingAttention:true});
    expect(await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps))
      .toMatchObject({ok:false,code:"QUOTE_AUTOMATION_ATTENTION_NOT_COMPLETED"});
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
  });

  it("replays an already completed internal attention action without duplicating it",async()=>{
    const t=fixture({duplicate:true,pending:false});
    expect(await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps))
      .toMatchObject({ok:true,value:{completedAttentionActions:0,reusedRuleExecutions:1}});
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
  });

  it("rejects replay after event snapshot drift before applying any internal actions",async()=>{
    const t=fixture({duplicate:true,drift:true});
    expect(await runTrustedAcceptedQuoteInternalAutomation(t.input,t.deps))
      .toMatchObject({ok:false,code:"QUOTE_AUTOMATION_REPLAY_DRIFT"});
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
  });
  it("never allows customer acceptance to directly send templates or fail an already accepted quote",()=>{
    const source=readFileSync(join(process.cwd(),
      "src/features/operations/customer-product-runtime.ts"),"utf8");
    expect(source).toContain('process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED === "true"');
    expect(source).toContain("if (!result.ok) return { ok: false, message: result.message };");
    expect(source).toContain("runTrustedAcceptedQuoteInternalAutomation({");
    expect(source).toContain('message: "Quote accepted. The next step is scheduling."');
    const bridge=readFileSync(join(process.cwd(),
      "src/server/workflows/customer-quote-accepted-bridge.ts"),"utf8");
    expect(bridge).not.toContain(".approveExternalAction(");
    expect(bridge).not.toContain(".markActionResult(");
    expect(bridge).not.toContain("sendEmail(");
    expect(bridge).toContain('eq("action_type","CREATE_ATTENTION")');
  });
});
