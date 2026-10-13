import { describe, expect, it, vi } from "vitest";
import { runOwnerSavedOperationalAutomation, type OwnerOperationalAutomationDependencies, type OwnerOperationalEventType } from "../../src/server/workflows/owner-operational-automation";

const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branch = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const quote = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const visit = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const invoice = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const serviceId = "11111111-1111-4111-8111-111111111111";
const attentionId = "22222222-2222-4222-8222-222222222222";
const actionId = "33333333-3333-4333-8333-333333333333";
const exceptionId = "44444444-4444-4444-8444-444444444444";

const cases: Array<{ kind: OwnerOperationalEventType; id: string; expected: Record<string,unknown> }> = [
  { kind:"QUOTE_ACCEPTED",id:quote,expected:{"quote.currency":"USD","quote.branchCode":"MAIN","request.serviceCode":"MOVE_OUT"}},
  { kind:"VISIT_COMPLETED",id:visit,expected:{"visit.branchCode":"MAIN","request.serviceCode":"MOVE_OUT"}},
  { kind:"INVOICE_PAID",id:invoice,expected:{"invoice.currency":"USD","invoice.branchCode":"MAIN","request.serviceCode":"MOVE_OUT"}},
  { kind:"ATTENTION_OPENED",id:exceptionId,expected:{"attention.type":"REQUEST_DELAYED","attention.severity":"CRITICAL","attention.branchCode":"MAIN"}},
];

function fixture(eventType: OwnerOperationalEventType,options:{
  role?:string;mode?:"SERVICE_ROLE"|"QA_SESSION_RLS";sourceStatus?:string;
  otherTenant?:boolean;wrongBranch?:boolean;duplicate?:boolean;drift?:boolean;workflowGenerated?:boolean;
}={}) {
  let isPending = true;
  const selectedStatus = options.sourceStatus ??
    (eventType === "QUOTE_ACCEPTED" ? "ACCEPTED" : eventType === "VISIT_COMPLETED" ? "COMPLETED" :
      eventType === "ATTENTION_OPENED" ? "OPEN" : "PAID");
  const rows: Record<string,Record<string,unknown>[]> = {
    quotes:[{id:quote,workspace_id:options.otherTenant?"foreign":workspace,request_id:request,
      status:eventType==="QUOTE_ACCEPTED"?selectedStatus:"ACCEPTED",currency:"USD",service_code:"MOVE_OUT"}],
    visits:[{id:visit,workspace_id:options.otherTenant?"foreign":workspace,request_id:request,
      branch_id:options.wrongBranch?"99999999-9999-4999-8999-999999999999":branch,
      status:eventType==="VISIT_COMPLETED"?selectedStatus:"COMPLETED"}],
    invoices:[{id:invoice,workspace_id:options.otherTenant?"foreign":workspace,quote_id:quote,
      status:eventType==="INVOICE_PAID"?selectedStatus:"PAID",currency:"USD",
      total_minor:24000,allocated_minor:27000,refunded_minor:3000,balance_minor:0}],
    requests:[{id:request,workspace_id:workspace,branch_id:branch,service_id:serviceId}],
    service_catalog:[{id:serviceId,workspace_id:workspace,code:"MOVE_OUT"}],
    workspace_branches:[{id:branch,workspace_id:workspace,code:"MAIN"}],
    workflow_rules:[{id:"rule-1",workspace_id:workspace,branch_id:branch,status:"ACTIVE",published_version_number:1}],
    workflow_rule_versions:[{id:"version-1",workspace_id:workspace,branch_id:branch,rule_id:"rule-1",
      version_number:1,state:"PUBLISHED",event_type:eventType,conditions:[],
      actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"REVIEW_MILESTONE"}],
      max_actions_per_event:3,created_at:"2026-10-12T00:00:00Z"}],
    workflow_executions:[{id:"execution-1",workspace_id:workspace,branch_id:branch,
      rule_version_id:"version-1",matched:true,event_fingerprint:options.drift?"old-fingerprint":"current-fingerprint"}],
    workflow_action_executions:[{id:actionId,workspace_id:workspace,branch_id:branch,
      execution_id:"execution-1",action_type:"CREATE_ATTENTION",state:"PENDING"}],
    attention_items:[
      {id:exceptionId,workspace_id:options.otherTenant?"foreign":workspace,
        status:eventType==="ATTENTION_OPENED"?selectedStatus:"OPEN",
        type:"REQUEST_DELAYED",severity:"CRITICAL",
        resource_type:options.workflowGenerated?"WORKFLOW_EXECUTION":"request",
        resource_id:request},
      {id:attentionId,workspace_id:workspace},
    ],
  };
  const tableNames:string[]=[];
  const service = { from(table:string) {
    tableNames.push(table);
    const filters:Array<[string,unknown]>=[];
    const list=()=>(rows[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v))
      .filter(()=>table!=="workflow_action_executions"||isPending);
    const q={
      select(){return q;},
      eq(key:string,value:unknown){filters.push([key,value]);return q;},
      maybeSingle:async()=>({data:list()[0]??null,error:null}),
      limit:async(n:number)=>({data:list().slice(0,n),error:null}),
    };
    return q;
  }};
  const evaluateAndRecord=vi.fn(async (input:{mode:string;event:{snapshot:Record<string,unknown>;eventType:string;sourceEventId:string}})=>{
    expect(input.mode).toBe("LIVE");
    expect(input.event.eventType).toBe(eventType);
    expect(input.event.sourceEventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(input.event.snapshot)).not.toContain("private");
    return {ok:true as const,value:{executionId:"execution-1",duplicate:options.duplicate??false,
      plan:{matched:true,eventFingerprint:"current-fingerprint",
        actionPlans:[{requiresOwnerApproval:false},{requiresOwnerApproval:true}]}}};
  });
  const executeAttentionAction=vi.fn(async()=>{
    isPending=false;
    return {ok:true as const,value:{attentionItemId:attentionId,actionExecutionId:actionId}};
  });
  const resolveActor=vi.fn(async()=>({ok:true as const,value:{
    workspace:{id:workspace,slug:"fictional-qa"},
    actor:{userId:"owner-1",workspaceId:workspace,role:options.role??"OWNER"},
    branchScope:{mode:"ALL",branches:[{id:branch}]},
    service,rpc:{},
  }}));
  return {tableNames,evaluateAndRecord,executeAttentionAction,resolveActor,
    deps:{resolveActor,mode:()=>options.mode??"SERVICE_ROLE",
      portFactory:()=>({evaluateAndRecord,executeAttentionAction})} as unknown as OwnerOperationalAutomationDependencies};
}

describe("Owner-run persisted operational milestones",()=>{
  for (const item of cases) {
    it(item.kind+": checks actual saved state, workspace, branch and writes only internal attention",async()=>{
      const t=fixture(item.kind);
      const result=await runOwnerSavedOperationalAutomation("fictional-qa",item.kind,item.id,t.deps);
      expect(result).toMatchObject({ok:true,value:{
        state:"PERSISTED_INTERNAL_WORKFLOW_PROCESSING",
        eventType:item.kind,sourceId:item.id,matchedExecutions:1,
        completedAttentionActions:1,externalApprovalRequired:1,
        newlyRecordedRuleExecutions:1,reusedRuleExecutions:0,providerMessagesSent:0}});
      expect(t.evaluateAndRecord).toHaveBeenCalledOnce();
      expect(t.evaluateAndRecord.mock.calls[0][0].event.snapshot).toEqual(item.expected);
      expect(t.executeAttentionAction).toHaveBeenCalledWith(workspace,actionId);
      expect(t.tableNames).toContain("attention_items");
    });
  }
  it("requires trusted backend, an actual owner and a saved positive milestone",async()=>{
    const disabled=fixture("QUOTE_ACCEPTED",{mode:"QA_SESSION_RLS"});
    expect(await runOwnerSavedOperationalAutomation("fictional-qa","QUOTE_ACCEPTED",quote,disabled.deps))
      .toMatchObject({ok:false,code:"OPERATIONAL_AUTOMATION_TRUSTED_BACKEND_REQUIRED"});
    expect(disabled.resolveActor).not.toHaveBeenCalled();
    for(const kind of cases) {
      const forbidden=fixture(kind.kind,{role:"DISPATCHER"});
      expect((await runOwnerSavedOperationalAutomation("fictional-qa",kind.kind,kind.id,forbidden.deps)).ok).toBe(false);
      expect(forbidden.evaluateAndRecord).not.toHaveBeenCalled();
      const unready=fixture(kind.kind,{sourceStatus:"DRAFT"});
      expect(await runOwnerSavedOperationalAutomation("fictional-qa",kind.kind,kind.id,unready.deps))
        .toMatchObject({ok:false,code:"OPERATIONAL_AUTOMATION_SOURCE_NOT_READY"});
      expect(unready.evaluateAndRecord).not.toHaveBeenCalled();
    }
  });
  it("rejects foreign workspace sources and mismatched visit/request branches",async()=>{
    const foreign=fixture("INVOICE_PAID",{otherTenant:true});
    expect(await runOwnerSavedOperationalAutomation("fictional-qa","INVOICE_PAID",invoice,foreign.deps))
      .toMatchObject({ok:false,code:"OPERATIONAL_AUTOMATION_NOT_FOUND"});
    expect(foreign.evaluateAndRecord).not.toHaveBeenCalled();
    const drift=fixture("VISIT_COMPLETED",{wrongBranch:true});
    expect(await runOwnerSavedOperationalAutomation("fictional-qa","VISIT_COMPLETED",visit,drift.deps))
      .toMatchObject({ok:false,code:"OPERATIONAL_AUTOMATION_BRANCH_DRIFT"});
  });
  it("refuses workflow-generated attention items to stop recursive exception fan-out",async()=>{
    const t=fixture("ATTENTION_OPENED",{workflowGenerated:true});
    expect(await runOwnerSavedOperationalAutomation("fictional-qa","ATTENTION_OPENED",exceptionId,t.deps))
      .toMatchObject({ok:false,code:"OPERATIONAL_AUTOMATION_SOURCE_NOT_READY"});
    expect(t.evaluateAndRecord).not.toHaveBeenCalled();
  });

  it("verifies stored fingerprint before resuming a retry; no double attention",async()=>{
    const replay=fixture("QUOTE_ACCEPTED",{duplicate:true});
    expect(await runOwnerSavedOperationalAutomation("fictional-qa","QUOTE_ACCEPTED",quote,replay.deps))
      .toMatchObject({ok:true,value:{reusedRuleExecutions:1,completedAttentionActions:1}});
    const changed=fixture("INVOICE_PAID",{duplicate:true,drift:true});
    expect(await runOwnerSavedOperationalAutomation("fictional-qa","INVOICE_PAID",invoice,changed.deps))
      .toMatchObject({ok:false,code:"OPERATIONAL_AUTOMATION_EVENT_DRIFT"});
    expect(changed.executeAttentionAction).not.toHaveBeenCalled();
  });
});
