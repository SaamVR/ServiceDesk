import {describe,expect,it} from "vitest";
import {planF15UnansweredLeadSla} from "../../src/server/workflows/sonic-f15-unanswered-lead-sla";
const w="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222",r="33333333-3333-4333-8333-333333333333";
const record=()=>({workspaceId:w,branchId:b,requestId:r,version:1,status:"NEW",
 createdAt:"2026-10-29T08:00:00.000Z",lastInboundAt:"2026-10-29T08:10:00.000Z",
 lastInboundMessageId:"44444444-4444-4444-8444-444444444444",
 lastStaffResponseAt:null,responseHistoryComplete:true});
const input=(change:Record<string,unknown>={},outer:Record<string,unknown>={})=>({
 record:{...record(),...change},observedAt:"2026-10-29T09:00:00.000Z",thresholdMinutes:30,...outer,
});
function candidate(value:unknown) {
 const result=planF15UnansweredLeadSla(value);
 expect(result.ok).toBe(true);
 if(!result.ok)throw Error("TEST_SOURCE_DENIED");
 return result.value;
}
describe("F15 unanswered-lead SLA",()=>{
 it("requires complete saved evidence, creates human review candidate only",()=>{
  const x=candidate(input());
  expect(x).toMatchObject({state:"UNPERSISTED_SLA_CANDIDATE",
   workspaceId:w,branchId:b,requestId:r,sourceVersion:1,
   dueAt:"2026-10-29T08:40:00.000Z",thresholdMinutes:30,
   eventType:"UNANSWERED_LEAD_SLA_REVIEW",approvalRequired:true,
   durableEventRecorded:false,providerCalled:false,customerMessageSent:false,
   workflowExecuted:false,moneyChanged:false});
  expect(x.eventKey).toMatch(/^[a-f0-9]{64}$/);
 });
 it("honors exact threshold and a later saved staff reply",()=>{
  expect(candidate(input({}, {observedAt:"2026-10-29T08:39:59.000Z"})).state).toBe("NO_ESCALATION_DUE");
  expect(candidate(input({}, {observedAt:"2026-10-29T08:40:00.000Z"})).state).toBe("UNPERSISTED_SLA_CANDIDATE");
  expect(candidate(input({lastStaffResponseAt:"2026-10-29T08:20:00.000Z"})).state).toBe("NO_ESCALATION_DUE");
  for(const status of ["READY","QUOTED","BOOKED","LOST","CLOSED"])
   expect(candidate(input({status})).state).toBe("NO_ESCALATION_DUE");
  expect(candidate(input({status:"COLLECTING"})).state).toBe("UNPERSISTED_SLA_CANDIDATE");
  expect(candidate(input({status:"NEEDS_REVIEW"})).state).toBe("UNPERSISTED_SLA_CANDIDATE");
  expect(candidate(input({lastStaffResponseAt:"2026-10-29T08:05:00.000Z"})).state)
   .toBe("UNPERSISTED_SLA_CANDIDATE");
 });
 it("keeps replay key across source versions; changes it for new inbound, tenant or branch",()=>{
  const x=candidate(input());
  expect(candidate(input({version:2})).eventKey).toBe(x.eventKey);
  expect(candidate(input({createdAt:"2026-10-29T08:00:00+00:00",
    lastInboundAt:"2026-10-29T08:10:00.000000+00:00"})).state)
    .toBe("UNPERSISTED_SLA_CANDIDATE");
  expect(candidate(input({createdAt:"2026-10-29T14:00:00+06:00"})).state)
    .toBe("UNPERSISTED_SLA_CANDIDATE");
  expect(candidate(input({lastInboundAt:"2026-10-29T08:20:00.000Z"})).eventKey).toBe(x.eventKey);
  for(const change of [
   {lastInboundAt:"2026-10-29T08:20:00.000Z",lastInboundMessageId:"66666666-6666-4666-8666-666666666666"},
   {lastInboundMessageId:"66666666-6666-4666-8666-666666666666"},
   {workspaceId:"55555555-5555-4555-8555-555555555555"},
   {branchId:"44444444-4444-4444-8444-444444444444"},
  ]) expect(candidate(input(change)).eventKey).not.toBe(x.eventKey);
 });
 it("rejects incomplete history, tenant collision, unknown source state and invalid policy",()=>{
  for(const v of [
   input({responseHistoryComplete:false}),input({responseHistoryComplete:null}),
   input({workspaceId:b}),input({requestId:w}),input({status:"CHARGED"}),
   input({lastInboundMessageId:"not-uuid"}), input({lastInboundMessageId:r}),
   input({version:0}),input({version:1.5}),
   input({}, {thresholdMinutes:14}),input({}, {thresholdMinutes:1441}),
  ]) expect(planF15UnansweredLeadSla(v).ok).toBe(false);
 });
 it("fails closed on future reply/inbound, invalid date, or clock before last inbound",()=>{
  for(const v of [
   input({lastStaffResponseAt:"2026-10-29T10:00:00.000Z"}),
   input({lastInboundAt:"2026-10-29T10:00:00.000Z"}),
   input({createdAt:"2026-10-29T08:11:00.000Z"}),
   input({createdAt:"2026-02-30T08:00:00.000Z"}),
   input({createdAt:"2026-10-29T08:00:00"}),
   input({createdAt:"2026-10-29T08:00:00+15:00"}),
   input({}, {observedAt:"2026-10-29T08:09:00.000Z"}),
   input({}, {observedAt:"not-a-date"}),
  ]) expect(planF15UnansweredLeadSla(v).ok).toBe(false);
 });
 it("rejects injected customer data, accessors, hidden fields and poisoned prototype",()=>{
  expect(planF15UnansweredLeadSla(input({customerEmail:"private@example.invalid"})).ok).toBe(false);
  const hidden=input();
  Object.defineProperty(hidden.record,"privateToken",{value:"secret",enumerable:false});
  expect(planF15UnansweredLeadSla(hidden).ok).toBe(false);
  const getter=input();
  Object.defineProperty(getter.record,"workspaceId",{get(){throw Error("bad");}});
  expect(planF15UnansweredLeadSla(getter).ok).toBe(false);
  expect(planF15UnansweredLeadSla(Object.assign(Object.create({isAdmin:true}),input())).ok).toBe(false);
  expect(planF15UnansweredLeadSla({...input(),sendCustomerEmail:true}).ok).toBe(false);
 });
});
