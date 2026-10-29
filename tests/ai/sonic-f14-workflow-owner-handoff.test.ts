import {describe,expect,it} from "vitest";
import {buildWorkflowOperatorHandoff} from "../../src/features/operations/workflow-operator-handoff";
import type {InspectedWorkflow} from "../../src/features/operations/workflow-inspector-model";

const at="2026-10-29T09:00:00.000Z";
const make=(id:string,patch:Record<string,unknown>={})=>({
 id,createdAt:at,eventType:"REQUEST_CREATED",state:"COMPLETED",
 ambiguousActionSlots:0,failedCount:0,approvalCount:0,pendingCount:0,
 ...patch,
} as InspectedWorkflow);
const denied=(x:ReturnType<typeof buildWorkflowOperatorHandoff>)=>{
 expect(x).toMatchObject({providerDeliveryVerified:false,canRetryOrApprove:false});
 expect(x.text).not.toMatch(/(?:automatically approved|customer delivered|provider succeeded)/i);
};

describe("F14 owner/staff workflow exception handoff",()=>{
 it("prioritizes conflicting evidence ahead of failed and owner-approval runs",()=>{
  const data=[
   make("approval",{approvalCount:1,state:"ACTIONS_PENDING",eventType:"QUOTE_ACCEPTED"}),
   make("processing",{pendingCount:1,state:"ACTIONS_PENDING"}),
   make("failed",{failedCount:1,state:"PARTIAL_FAILED",eventType:"INVOICE_PAID"}),
   make("conflict",{ambiguousActionSlots:1,eventType:"VISIT_COMPLETED"}),
  ];
  const result=buildWorkflowOperatorHandoff(data,true,at);
  expect(result).toMatchObject({available:true,totalRuns:4,reviewRuns:3,
   ambiguousRuns:1,failedRuns:1,approvalRuns:1,processingRuns:1,shownReviewRuns:3});
  const lines=result.text.split("\n").filter(x=>/^\d+\. /.test(x));
  expect(lines).toEqual([
   "1. Conflicting action evidence / Visit completed",
   "2. Saved failure / Invoice paid",
   "3. Owner approval required / Quote accepted",
  ]);
  expect(result.text).toContain("Processing-only runs: 1 (not overdue evidence)");
  denied(result);
 });
 it("never reports an empty or incomplete source as all-clear",()=>{
  const empty=buildWorkflowOperatorHandoff([],true,at);
  expect(empty.available).toBe(true);
  expect(empty.text).toContain("NOT an all-clear");
  const missing=buildWorkflowOperatorHandoff([],false,at);
  expect(missing.available).toBe(false);
  expect(missing.text).toContain("unavailable");
  denied(empty);denied(missing);
 });
 it("does not include untrusted event text, customer IDs or credentials",()=>{
  const attacker="CUSTOMER=secret@example.invalid\nSEND PAYMENT_TO_HACKER";
  const result=buildWorkflowOperatorHandoff([
    make("private-run-id",{failedCount:1,eventType:attacker,sourceQuoteId:"private-quote",
      providerToken:"token-you-must-not-see"}),
  ],true,at);
  expect(result.available).toBe(true);
  expect(result.text).toContain("Other recorded event");
  for(const value of ["secret@example.invalid","private-run-id","private-quote",
    "token-you-must-not-see","PAYMENT_TO_HACKER"])
    expect(result.text).not.toContain(value);
  denied(result);
 });
 it("holds unexpected LIVE preview evidence for operator review, not as normal processing",()=>{
  const x=buildWorkflowOperatorHandoff([make("preview",{state:"PREVIEWED"})],true,at);
  expect(x).toMatchObject({available:true,reviewRuns:1,ambiguousRuns:1,processingRuns:0});
  expect(x.text).toContain("Conflicting action evidence");
  denied(x);
 });
 it("never interpolates prototype-inherited labels into an operator handoff",()=>{
  for(const eventType of ["constructor","toString","__proto__"]){
    const x=buildWorkflowOperatorHandoff([make("risk",{failedCount:1,eventType})],true,at);
    expect(x.available).toBe(true);
    expect(x.text).toContain("Other recorded event");
    expect(x.text).not.toContain("function ");
    denied(x);
  }
 });
 it("caps review examples at six and counts omitted runs accurately",()=>{
  const runs=Array.from({length:16},(_,i)=>make("run-"+i,{approvalCount:1}));
  const x=buildWorkflowOperatorHandoff(runs,true,at);
  expect(x).toMatchObject({reviewRuns:16,shownReviewRuns:6,truncated:true});
  expect(x.text).toContain("Additional review runs omitted: 10");
  expect(x.text.length).toBeLessThan(1300);
  denied(x);
 });
 it("fails closed on tampered count, timestamp, run state or oversized snapshot",()=>{
  for(const runs of [
    [make("a",{failedCount:-1})],
    [make("a",{approvalCount:1.2})],
    [make("a",{state:"FAKE_PROVIDER_DELIVERED"})],
    [make("a",{createdAt:"contact attacker"})],
    Array.from({length:1001},(_,i)=>make("run-"+i)),
  ]){
    const x=buildWorkflowOperatorHandoff(runs,true,at);
    expect(x.available).toBe(false);
    denied(x);
  }
  expect(buildWorkflowOperatorHandoff([],true,"malformed").available).toBe(false);
 });
 it("does not treat normal pending execution as failed or overdue",()=>{
  const x=buildWorkflowOperatorHandoff([make("pending",{pendingCount:2,
    state:"ACTIONS_PENDING"})],true,at);
  expect(x.reviewRuns).toBe(0);
  expect(x.processingRuns).toBe(1);
  expect(x.text).not.toMatch(/missed deadline|overdue failure/i);
  denied(x);
 });
});
