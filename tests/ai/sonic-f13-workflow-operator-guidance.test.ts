import {describe,expect,it} from "vitest";
import {guideRecordedWorkflowIntervention} from "../../src/features/operations/workflow-operator-guidance";
const run=(fields:Record<string,unknown>={})=>guideRecordedWorkflowIntervention({
 ambiguousActionSlots:0,failedCount:0,approvalCount:0,pendingCount:0,
 state:"COMPLETED",...fields,
} as Parameters<typeof guideRecordedWorkflowIntervention>[0]);
const denied=(x:ReturnType<typeof run>)=>{
 expect(x).toMatchObject({
  approvalStillRequired:true,automaticRetryAuthorized:false,
  automaticApprovalAuthorized:false,customerMessageAuthorized:false,
  financialMutationAuthorized:false,rulePublicationAuthorized:false,
  providerDeliveryVerified:false,
 });
};
describe("F13 persisted workflow operator guidance",()=>{
 it("holds ambiguous attempts ahead of all other outcomes",()=>{
  const r=run({ambiguousActionSlots:2,failedCount:3,approvalCount:2,pendingCount:1,state:"PARTIAL_FAILED"});
  expect(r).toMatchObject({disposition:"HOLD_AND_RECONCILE",nextStep:"INSPECT_ACTION_ATTEMPTS"});
  expect(r.title).toMatch(/do not replay/i);
  denied(r);
 });
 it("surfaces saved failure only as manual review, never auto retry",()=>{
  for(const data of [{failedCount:2},{state:"PARTIAL_FAILED"}]){
   const x=run(data);
   expect(x).toMatchObject({disposition:"REVIEW_FAILURE",nextStep:"VERIFY_SOURCE_AND_RULE"});
   denied(x);
  }
 });
 it("does not conflate explicit approval-required with authorization",()=>{
  const x=run({approvalCount:1,state:"ACTIONS_PENDING"});
  expect(x).toMatchObject({disposition:"OWNER_APPROVAL_REQUIRED",nextStep:"OPEN_OWNER_APPROVAL"});
  denied(x);
 });
 it("processing and pending are not called failures or overdue",()=>{
  for(const state of ["ACTIONS_PENDING"]){
   const x=run({state});
   expect(x).toMatchObject({disposition:"PROCESSING_ONLY",nextStep:"WAIT_FOR_SAVED_OUTCOME"});
   expect(x.detail).not.toMatch(/overdue|late|deadline missed/i);
   denied(x);
  }
 });
 it("completed run is not mislabeled as verified customer delivery",()=>{
  const x=run();
  expect(x).toMatchObject({disposition:"NO_INTERVENTION_VERIFIED",
   providerDeliveryVerified:false});
  denied(x);
 });
 it("fails conservatively on damaged or injected numeric states",()=>{
  for(const fields of [{failedCount:-1},{pendingCount:1.5},{approvalCount:999999},
   {state:"SUCCESS_ALL_CUSTOMERS_NOTIFIED"},{state:"FAILED"},{state:"PENDING"},
   {state:"PREVIEWED"},{ambiguousActionSlots:NaN}]){
   const x=run(fields);
   expect(x.disposition).toBe("HOLD_AND_RECONCILE");denied(x);
  }
 });
 it("always returns one fixed, bounded read-only instruction and no command",()=>{
  for(const change of [{},{failedCount:1},{approvalCount:1},{pendingCount:2},
   {ambiguousActionSlots:1}]){
   const x=run(change);
   const serialized=JSON.stringify(x);
   expect(serialized.length).toBeLessThan(900);
   expect(serialized).not.toContain("https://");
   expect(serialized).not.toContain("example.com");
   denied(x);
  }
 });
});
