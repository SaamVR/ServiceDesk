import {describe,expect,it} from "vitest";
import {planSonicF10FieldRecovery} from "../../src/server/ai/sonic-f10-field-recovery";
const hold={kind:"DISPATCH_HOLD_EXPIRY",status:"HELD",holdId:"hold_01",
 expiresAt:"2026-10-25T08:00:00Z",releaseState:"NOT_RELEASED"};
const complaint={kind:"COMPLAINT_RECOVERY",status:"OPEN",
 reportedAt:"2026-10-25T08:00:00Z",severity:"HIGH",responseState:"NOT_RESPONDED"};
const make=(record:Record<string,unknown>,extra:Record<string,unknown>={})=>({
 actor:{workspaceId:"tenant_a",role:"OWNER"},workspaceId:"tenant_a",
 branchId:"branch_a",asOf:"2026-10-26T08:00:00Z",expectedVersion:2,
 record:{workspaceId:"tenant_a",branchId:"branch_a",sourceId:"case_01",
  sourceVersion:2,...record},...extra,
});
describe("SONIC F10 appointment hold and complaint recovery policy",()=>{
 it("flags a saved overdue hold but never releases a booking or slot",()=>{
  const r=planSonicF10FieldRecovery(make(hold));
  expect(r.ok).toBe(true);
  if(!r.ok)return;
  expect(r.value).toMatchObject({
   kind:"DISPATCH_HOLD_EXPIRY",decision:"REVIEW_RECOMMENDED",
   proposedTask:"REVIEW_EXPIRED_HOLD",holdReleased:false,crewReassigned:false,
   saved:false,scheduled:false,executed:false,ownerApprovalRequired:true,
  });
  expect(r.value.fingerprint).toMatch(/^[a-f0-9]{64}$/);
 });
 it("flags only saved unresponded severe complaints, never sends or refunds",()=>{
  const r=planSonicF10FieldRecovery(make(complaint));
  expect(r.ok).toBe(true);
  if(r.ok)expect(r.value).toMatchObject({
   kind:"COMPLAINT_RECOVERY",decision:"REVIEW_RECOMMENDED",
   proposedTask:"REVIEW_COMPLAINT_RECOVERY",
   complaintClosed:false,refundIssued:false,customerMessageSent:false,
  });
 });
 it("distinguishes not-due reviews without triggering a timer",()=>{
  const cases=[
   {...hold,expiresAt:"2026-10-27T08:00:00Z"},
   {...complaint,reportedAt:"2026-10-26T07:00:00Z"},
  ];
  for(const x of cases){
   const r=planSonicF10FieldRecovery(make(x));
   expect(r.ok).toBe(true);
   if(r.ok)expect(r.value).toMatchObject({
    decision:"NOT_DUE",proposedTask:null,fingerprint:null,
    scheduled:false,executed:false,
   });
  }
 });
 it("rejects foreign workspace, non-owner and stale source version",()=>{
  expect(planSonicF10FieldRecovery(make(hold,{actor:{workspaceId:"tenant_a",role:"STAFF"}})))
   .toMatchObject({ok:false,code:"F10_FIELD_OWNER_REQUIRED"});
  expect(planSonicF10FieldRecovery(make({...hold,workspaceId:"tenant_b"})))
   .toMatchObject({ok:false,code:"F10_FIELD_TENANT_MISMATCH"});
  expect(planSonicF10FieldRecovery(make(hold,{expectedVersion:3})))
   .toMatchObject({ok:false,code:"F10_FIELD_STALE"});
 });
 it("refuses already released slots, closed/refunded complaints and implausible times",()=>{
  for(const x of [
   {...hold,releaseState:"RELEASED"},
   {...hold,status:"CONFIRMED"},
   {...hold,expiresAt:"2026-02-30T08:00:00Z"},
   {...complaint,status:"CLOSED"},
   {...complaint,responseState:"RESPONDED"},
   {...complaint,severity:"LOW"},
  ])expect(planSonicF10FieldRecovery(make(x)))
   .toMatchObject({ok:false,code:"F10_FIELD_EVIDENCE_INVALID"});
 });
 it("denies customer send/auto release flags and getter-backed source kind",()=>{
  expect(planSonicF10FieldRecovery(make({...hold,autoRelease:true})))
   .toMatchObject({ok:false,code:"F10_FIELD_INVALID"});
  const x=make(complaint);
  Object.defineProperty(x.record,"kind",{enumerable:true,get(){throw Error("side effect")}});
  expect(planSonicF10FieldRecovery(x)).toMatchObject({ok:false,code:"F10_FIELD_INVALID"});
 });
});
