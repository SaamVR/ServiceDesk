import { describe, expect, it, vi } from "vitest";
import { MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH, WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT } from "../../src/server/workflows/automation-limits";
import { runOwnerSavedRequestAutomation, type OwnerRequestAutomationDependencies } from "../../src/server/workflows/owner-request-automation";
import { runOwnerSavedOperationalAutomation, type OwnerOperationalAutomationDependencies } from "../../src/server/workflows/owner-operational-automation";

const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branch = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const quote = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function dependencies(count:number) {
  const requestedLimits:number[]=[];
  const tableCounts:Record<string,Record<string,unknown>[]> = {
    requests:[{id:request,workspace_id:workspace,branch_id:branch,service_id:null,customer_id:null}],
    quotes:[{id:quote,workspace_id:workspace,request_id:request,status:"ACCEPTED",currency:"USD",service_code:"",
      subtotal_minor:10000,tax_minor:0,total_minor:10000,deposit_minor:2500,
      balance_minor:7500,duration_minutes:75,
      snapshot:{lineItems:[{code:"BASE",description:"Base cleaning",
        amountMinor:10000,durationMinutes:75}]}}],
    workspace_branches:[{id:branch,workspace_id:workspace,code:"MAIN"}],
    workflow_rules:Array.from({length:count},(_,i)=>({
      id:"rule-"+i,workspace_id:workspace,branch_id:branch,status:"ACTIVE",published_version_number:null,
    })),
  };
  const service={from(table:string) {
    const filters:Array<[string,unknown]>=[];
    const rows=()=>(tableCounts[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v));
    const q={
      select(){return q;},
      eq(key:string,value:unknown){filters.push([key,value]);return q;},
      maybeSingle:async()=>({data:rows()[0]??null,error:null}),
      limit:async(n:number)=>{requestedLimits.push(n);return {data:rows().slice(0,n),error:null};},
    };
    return q;
  }};
  const resolveActor=vi.fn(async()=>({ok:true as const,value:{
    workspace:{id:workspace,slug:"fictional-qa"},
    actor:{userId:"owner-1",workspaceId:workspace,role:"OWNER"},
    branchScope:{mode:"ALL",branches:[{id:branch}]},
    service,rpc:{},
  }}));
  const portFactory=vi.fn();
  const deps={mode:()=>"SERVICE_ROLE",resolveActor,portFactory};
  return {deps,requestedLimits,portFactory};
}

describe("safe and scalable owner automation catalogue capacity",()=>{
  it("supports all 27 starters and additional published rules but hard bounds fan-out",()=>{
    expect(MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH).toBeGreaterThanOrEqual(27);
    expect(MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH).toBeLessThanOrEqual(100);
    expect(WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT).toBe(MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH+1);
  });
  it("allows 64 in-scope rules without running any unpublished rule",async()=>{
    const t=dependencies(MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH);
    const result=await runOwnerSavedRequestAutomation("fictional-qa",request,t.deps as unknown as OwnerRequestAutomationDependencies);
    expect(result).toMatchObject({ok:true,value:{matchedExecutions:0,providerMessagesSent:0}});
    expect(t.requestedLimits).toContain(WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT);
    expect(t.portFactory).toHaveBeenCalledOnce();
  });
  it("rejects 65 active rules before executing any request action",async()=>{
    const t=dependencies(MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH+1);
    expect(await runOwnerSavedRequestAutomation("fictional-qa",request,t.deps as unknown as OwnerRequestAutomationDependencies))
      .toMatchObject({ok:false,code:"REQUEST_WORKFLOW_RULE_LIMIT"});
    expect(t.portFactory).not.toHaveBeenCalled();
  });
  it("applies the same overflow cap to persisted accepted quotes",async()=>{
    const t=dependencies(MAX_ACTIVE_WORKFLOW_RULES_PER_BRANCH+1);
    expect(await runOwnerSavedOperationalAutomation("fictional-qa","QUOTE_ACCEPTED",quote,t.deps as unknown as OwnerOperationalAutomationDependencies))
      .toMatchObject({ok:false,code:"OPERATIONAL_AUTOMATION_RULE_LIMIT"});
    expect(t.portFactory).not.toHaveBeenCalled();
    expect(t.requestedLimits).toContain(WORKFLOW_RULE_OVERFLOW_FETCH_LIMIT);
  });
});
