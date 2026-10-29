import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {projectOwnerAttentionReview} from "../../src/features/operations/owner-attention-review-projection";
import type {OwnerAttentionSlaResult} from "../../src/server/ai/owner-attention-sla";

const now="2026-10-29T07:00:00.000Z";
const alert=(id:string,overrides:Record<string,unknown>={})=>({
 attentionId:id,severity:"CRITICAL",status:"OPEN",dueAt:now,
 overdueMinutes:80,ownerReviewRequired:true,...overrides,
});
const proof=(rows:Record<string,unknown>[]=[],
 change:Record<string,unknown>={}):OwnerAttentionSlaResult=>({
 ok:true,value:{
  state:"SAVED_ATTENTION_SLA_OWNER_REVIEW",
  source:"DOUBLE_CHECKED_SAVED_ATTENTION_ROWS",
  workspaceId:"workspace-1",inspected:rows.length,
  overdueCount:rows.length,unscheduledCount:0,
  overdue:rows,ownerReviewRequired:true,modelInvoked:false,
  customerMessaged:false,workflowExecuted:false,...change,
 },
} as unknown as OwnerAttentionSlaResult);
describe("A18 owner attention source projection and action UI",()=>{
 it("projects only fixed status/severity/time, never resource ids or private messages",()=>{
  const raw=alert("attention-1",{customerEmail:"private@example.invalid",
   summary:"Customer invoice contents",resourceId:"private-workflow-id"});
  const x=projectOwnerAttentionReview(proof([raw]));
  expect(x).toMatchObject({ok:true,state:"SAVED_OWNER_ATTENTION_REVIEW_ONLY",
   overdueCount:1,unscheduledCount:0,providerDeliveryVerified:false,
   customerMessaged:false,modelInvoked:false,workflowExecuted:false,
   ownerReviewRequired:true,
   visible:[{severity:"CRITICAL",status:"OPEN",dueAt:now,overdueMinutes:80}]});
  expect(JSON.stringify(x)).not.toMatch(/private@example|invoice contents|private-workflow-id|attention-1/);
 });
 it("caps six examples while preserving total and omission count",()=>{
  const rows=Array.from({length:15},(_,i)=>alert("attention-"+i));
  const x=projectOwnerAttentionReview(proof(rows));
  expect(x).toMatchObject({ok:true,inspected:15,overdueCount:15,
    omittedCount:9,providerDeliveryVerified:false});
  if(x.ok)expect(x.visible).toHaveLength(6);
 });
 it("does not present zero overdue as global all-clear or provider proof",()=>{
  const x=projectOwnerAttentionReview(proof([], {inspected:1,unscheduledCount:1}));
  expect(x).toMatchObject({ok:true,overdueCount:0,unscheduledCount:1,
   providerDeliveryVerified:false,ownerReviewRequired:true});
 });
 it("rejects changed source, contradictions, fake provider flags, and forged timestamps",()=>{
  const bad:OwnerAttentionSlaResult[]=[
   {ok:false,code:"ATTENTION_SOURCE_CHANGED"},
   proof([alert("attention-1")],{overdueCount:0}),
   proof([alert("attention-1")],{unscheduledCount:5}),
   proof([alert("attention-1")],{customerMessaged:true}),
   proof([alert("attention-1")],{workflowExecuted:true}),
   proof([alert("attention-1",{dueAt:"2026-02-30T12:00:00Z"})]),
   proof([alert("attention-1",{status:"RESOLVED"})]),
   proof([alert("attention-1",{severity:"SOMETHING_ELSE"})]),
   proof([alert("attention-1",{ownerReviewRequired:false})]),
   proof([alert("attention-1"),alert("attention-1")]),
  ];
  bad.forEach(item=>expect(projectOwnerAttentionReview(item)).toMatchObject({
    ok:false,state:"ATTENTION_EVIDENCE_UNAVAILABLE"}));
 });
 it("supports genuinely old overdue evidence instead of hiding it after 3.5 days",()=>{
  const x=projectOwnerAttentionReview(proof([alert("old",{overdueMinutes:35000})]));
  expect(x).toMatchObject({ok:true,visible:[{overdueMinutes:35000}]});
 });
 it("rejects hidden accessors, sparse arrays and prototype pollution",()=>{
  const a=alert("attention-1");
  Object.defineProperty(a,"overdueMinutes",{get(){throw Error("forbidden");}});
  expect(projectOwnerAttentionReview(proof([a]))).toMatchObject({ok:false});
  const x=proof([alert("attention-1")]);
  if(x.ok) {
   const fake=Object.create({inheritedTenant:"foreign"});
   Object.assign(fake,x.value.overdue[0]);
   (x.value.overdue as unknown[])[0]=fake;
  }
  expect(projectOwnerAttentionReview(x).ok).toBe(false);
  const sparse=proof([alert("attention-1"),alert("attention-2")]);
  if(sparse.ok) delete (sparse.value.overdue as unknown[])[0];
  expect(projectOwnerAttentionReview(sparse).ok).toBe(false);
 });
 it("owner only reads on explicit request with double-check, no worker or payments",()=>{
  const action=readFileSync("src/features/operations/owner-attention-review-action.ts","utf8");
  const ui=readFileSync("src/features/operations/OwnerOverdueAttentionReview.tsx","utf8");
  const route=readFileSync("src/features/operations/OperationalProductRoute.tsx","utf8");
  expect(action).toContain("loadOwnerAttentionSla(workspaceSlug)");
  expect(action).toContain("projectOwnerAttentionReview(source)");
  expect(action).not.toContain("sendEmail(");
  expect(ui).toContain("requestOwnerOverdueAttentionReview(workspaceSlug)");
  expect(ui).toContain("active.current.timedOut=true");
  expect(ui).toContain("if(!active.current.timedOut)");
  expect(ui).toContain('aria-label="Double-checked saved owner exceptions"');
  expect(route.split('<OwnerOverdueAttentionReview workspaceSlug={workspaceSlug} />').length-1).toBe(2);
  expect(route).toContain('data.actor.role === "OWNER" ? <OwnerOverdueAttentionReview');
  expect(ui).not.toContain("retryOperationalWorkflow");
 });
});
