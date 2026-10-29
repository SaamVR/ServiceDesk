import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {planF15UnansweredLeadSla} from "../../src/server/workflows/sonic-f15-unanswered-lead-sla";
import {ingestF15UnansweredLeadCandidate} from "../../src/server/workflows/sonic-f15-atomic-ingress";
const read=(name:string)=>readFileSync(name,"utf8");
describe("F15 independent critic: no false durable or provider claims",()=>{
 it("has no hard-wired provider, service-role worker, scheduler or credentials",()=>{
  const sla=read("src/server/workflows/sonic-f15-unanswered-lead-sla.ts");
  const ingress=read("src/server/workflows/sonic-f15-atomic-ingress.ts");
  expect(sla).toContain("responseHistoryComplete !== true");
  expect(sla).toContain("UNPERSISTED_SLA_CANDIDATE");
  expect(sla).toContain("lastInboundAt");
  expect(ingress).toContain("F15_DURABLE_PORT_REQUIRED");
  expect(ingress).toContain("sourceRecheckedUnderLock === true");
  expect(ingress).toContain("uniqueEventKeyEnforced === true");
  expect(ingress).toContain("externalSideEffects === false");
  expect(ingress).toContain("transactionCommitted === true");
  for(const body of [sla,ingress]){
   expect(body).not.toContain("service_role");
   expect(body).not.toContain("sendEmail(");
   expect(body).not.toContain("setInterval(");
   expect(body).not.toContain("process.env");
  }
 });
 it("never equates a candidate to real persisted processing without a port",async()=>{
  const input={record:{
   workspaceId:"11111111-1111-4111-8111-111111111111",
   branchId:"22222222-2222-4222-8222-222222222222",
   requestId:"33333333-3333-4333-8333-333333333333",
   version:3,status:"NEW",createdAt:"2026-10-29T08:00:00.000Z",
   lastInboundAt:"2026-10-29T08:10:00.000Z",
   lastStaffResponseAt:null,responseHistoryComplete:true,
  },observedAt:"2026-10-29T09:00:00.000Z",thresholdMinutes:30};
  expect(planF15UnansweredLeadSla(input)).toMatchObject({ok:true,value:{
   state:"UNPERSISTED_SLA_CANDIDATE",durableEventRecorded:false,
   providerCalled:false,customerMessageSent:false,moneyChanged:false}});
  expect(await ingestF15UnansweredLeadCandidate(input)).toMatchObject({
   ok:false,code:"F15_DURABLE_PORT_REQUIRED"});
 });
});
