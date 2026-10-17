import { describe, expect, it } from "vitest";
import { validateWorkflowEventEnvelope, evaluateWorkflowRule } from "../../src/server/workflows/engine";
import type { WorkflowEventEnvelope } from "../../src/server/workflows/engine";
import type { WorkflowRuleVersionDTO } from "../../src/contracts";

const event:WorkflowEventEnvelope={workspaceId:"workspace-1",branchId:"branch-1",eventType:"REQUEST_CREATED",
  sourceEventId:"source-123",recursionDepth:0,snapshot:{"request.serviceCode":"STANDARD"}};
describe("R33 Core event ingester must fail closed under malformed recovered JSON",()=>{
  const refuse=(e:unknown,code?:string)=>{
    expect(()=>validateWorkflowEventEnvelope(e as WorkflowEventEnvelope)).not.toThrow();
    const result=validateWorkflowEventEnvelope(e as WorkflowEventEnvelope);
    expect(result.ok).toBe(false);
    if(code) expect(result).toMatchObject({ok:false,code});
  };
  it("accepts valid stable persisted event and a safe null-prototype JSON-like payload",()=>{
    expect(validateWorkflowEventEnvelope(event)).toMatchObject({ok:true});
    expect(validateWorkflowEventEnvelope({...event,snapshot:Object.assign(Object.create(null),event.snapshot)}))
      .toMatchObject({ok:true});
  });
  it("never throws on missing or forged nonrecord snapshot",()=>{
    for(const bad of [null,undefined,[],1,"bad",{...event,snapshot:null},{...event,snapshot:[]},
      {...event,snapshot:"x"}, {...event,snapshot:new Date()},
      {...event,snapshot:Object.create({hidden:"private"})}]) refuse(bad);
  });
  it("rejects NaN/Infinity values, including scalars and array elements",()=>{
    for(const bad of [NaN,Infinity,-Infinity]){
      refuse({...event,snapshot:{"request.serviceCode":bad}},"WORKFLOW_EVENT_VALUE_INVALID");
      refuse({...event,snapshot:{"request.serviceCode":[bad]}},"WORKFLOW_EVENT_VALUE_INVALID");
    }
    refuse({...event,snapshot:{"request.serviceCode":["x".repeat(161)]}},"WORKFLOW_EVENT_VALUE_INVALID");
    refuse({...event,snapshot:{"request.serviceCode":{ nested:"secret" }}},"WORKFLOW_EVENT_VALUE_INVALID");
  });
  it("rejects unbounded or nonstring scope and malicious inherited accessors",()=>{
    refuse({...event,workspaceId:"x".repeat(10000)},"WORKFLOW_EVENT_SCOPE_INVALID");
    refuse({...event,branchId:42},"WORKFLOW_EVENT_SCOPE_INVALID");
    refuse({...event,parentExecutionId:"bad/key"},"WORKFLOW_EVENT_SCOPE_INVALID");
    const snapshot=Object.defineProperty({}, "request.serviceCode", {
      enumerable:true,get(){throw Error("sensitive resolver executed");},
    });
    refuse({...event,snapshot},"WORKFLOW_EVENT_SNAPSHOT_INVALID");
  });
  it("critic: nonenumerable private source data cannot bypass event snapshot allowlist",()=>{
    const snapshot=Object.defineProperty({"request.serviceCode":"STANDARD"},
      "customer.privateNotes",{value:"PRIVATE_NOTES",enumerable:false});
    refuse({...event,snapshot},"WORKFLOW_EVENT_SNAPSHOT_INVALID");
    const symbol=Symbol("hidden");
    const symbolic={"request.serviceCode":"STANDARD",[symbol]:"PRIVATE"};
    refuse({...event,snapshot:symbolic},"WORKFLOW_EVENT_SNAPSHOT_INVALID");
  });
  it("retains valid source identity and same fingerprint on equivalent persisted events",()=>{
    const version={
      id:"version-1",workspaceId:"workspace-1",branchId:"branch-1",ruleId:"rule-1",
      versionNumber:1,state:"PUBLISHED" as const,eventType:"REQUEST_CREATED" as const,
      conditions:[{field:"request.serviceCode",operator:"EQ" as const,value:"STANDARD"}],
      actions:[{type:"CREATE_ATTENTION" as const,severity:"WARNING" as const,summaryKey:"SCOPE_REVIEW"}],
      maxActionsPerEvent:1,createdAt:"2026-10-18T00:00:00Z",
    } satisfies WorkflowRuleVersionDTO;
    const a=evaluateWorkflowRule(version,event,"LIVE");
    const b=evaluateWorkflowRule(version,{...event,snapshot:{...event.snapshot}},"LIVE");
    expect(a).toMatchObject({ok:true,value:{matched:true}});
    expect(b).toMatchObject({ok:true,value:{matched:true}});
    if(a.ok&&b.ok)expect(a.value.eventFingerprint).toBe(b.value.eventFingerprint);
  });
});
