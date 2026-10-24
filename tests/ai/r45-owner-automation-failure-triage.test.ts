import {describe,expect,it} from "vitest";
import {planOwnerAutomationFailureTriage} from "../../src/server/ai/automation-failure-triage";
const workspaceId="workspace-a",now="2026-10-24T10:00:00.000Z";
const actor={workspaceId,role:"OWNER"};
const one=(executionId:string,status:"TRANSIENT_FAILURE"|"PERMANENT_FAILURE"|"RETRY_EXHAUSTED"|"CONFIGURATION_BLOCKED"="TRANSIENT_FAILURE")=>({
 workspaceId,executionId,eventId:"event-"+executionId,status,occurredAt:"2026-10-24T09:00:00.000Z",
 attempts:1,maxAttempts:3,
});
const input=(failures:ReturnType<typeof one>[])=>({actor,workspaceId,now,failures});
describe("SONIC AI owner saved automation failure triage",()=>{
 it("sorts actionable review categories, does not attempt any recovery itself",()=>{
  const r=planOwnerAutomationFailureTriage(input([
    one("run-2"),one("run-1","CONFIGURATION_BLOCKED"),one("run-3","PERMANENT_FAILURE"),
    {...one("run-4"),attempts:3},
  ]));
  expect(r).toMatchObject({ok:true,value:{
    state:"OWNER_AUTOMATION_FAILURE_REVIEW_ONLY",inspected:4,operatorReviewCount:3,
    retryCandidateCount:1,retriesEnqueued:false,messagesSent:false,modelInvoked:false,
    items:[{action:"CHECK_CONFIGURATION"},{action:"REVIEW_RETRY_BUDGET"},
      {action:"REVIEW_PERMANENT_FAILURE"},{action:"REVIEW_TRANSIENT_RETRY"}],
  }});
 });
 it("rejects cross-workspace scope, actor changes, duplicate executions and future receipts",()=>{
   expect(planOwnerAutomationFailureTriage({...input([one("run-1")]),actor:{workspaceId,role:"DISPATCHER"}}))
     .toMatchObject({ok:false,code:"AUTOMATION_TRIAGE_OWNER_REQUIRED"});
   for(const failures of [
      [one("run-1"),one("run-1")],
      [{...one("run-1"),workspaceId:"workspace-b"}],
      [{...one("run-1"),occurredAt:"2026-10-25T01:00:00.000Z"}],
      [{...one("run-1"),attempts:Infinity}],
   ])expect(planOwnerAutomationFailureTriage(input(failures)))
     .toMatchObject({ok:false,code:"AUTOMATION_TRIAGE_EVIDENCE_INVALID"});
 });
 it("refuses hidden unapproved receipts and malformed array indexes",()=>{
   const hidden=Object.defineProperty(one("run-1"),"secret",{value:"private",enumerable:false});
   expect(planOwnerAutomationFailureTriage(input([hidden])))
     .toMatchObject({ok:false,code:"AUTOMATION_TRIAGE_EVIDENCE_INVALID"});
   const sparse=[one("run-1"),one("run-2")];delete (sparse as Array<typeof sparse[number] | undefined>)[1];
   expect(planOwnerAutomationFailureTriage(input(sparse)))
     .toMatchObject({ok:false,code:"AUTOMATION_TRIAGE_EVIDENCE_INVALID"});
 });
 it("independent critic: disallow hidden array index evidence",()=>{
   const forged=[one("run-1")];
   Object.defineProperty(forged,"0",{value:one("run-1"),enumerable:false,configurable:true});
   expect(planOwnerAutomationFailureTriage(input(forged)))
     .toMatchObject({ok:false,code:"AUTOMATION_TRIAGE_EVIDENCE_INVALID"});
 });
 it("does not expose raw source payloads, payment records or customer PII",()=>{
   const r=planOwnerAutomationFailureTriage(input([one("run-1")]));
   expect(JSON.stringify(r)).not.toContain("Bearer");
   expect(JSON.stringify(r)).not.toContain("customerEmail");
 });
});
