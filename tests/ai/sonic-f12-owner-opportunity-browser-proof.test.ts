import {describe,expect,it} from "vitest";
import {parseOwnerOpportunityPreview} from "../../src/features/operations/owner-opportunity-preview-proof";
const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const base=()=>({
 ok:true,state:"OWNER_OPPORTUNITY_REVIEW_ONLY",
 source:"DOUBLE_CHECKED_OWNER_WORKDAY_AND_ACTIVE_WORKSPACE_BRANCH",
 workspaceId:ws,branchId:branch,inspectedPriorities:2,
 suggestions:[
  {evidenceKey:"CRITICAL_ATTENTION",savedCount:2,target:"FUTURE_ATTENTION_OPENED",
   eventType:"ATTENTION_OPENED",severity:"CRITICAL",summaryKey:"AI_TRIAGE_EXCEPTION",
   existingCasesProcessed:false,published:false,requiresOwnerApproval:true},
  {evidenceKey:"OPEN_REQUEST",savedCount:4,target:"FUTURE_REQUEST_CREATED",
   eventType:"REQUEST_CREATED",severity:"WARNING",summaryKey:"AI_REVIEW_NEW_REQUEST",
   existingCasesProcessed:false,published:false,requiresOwnerApproval:true},
 ],
 modelInvoked:false,saved:false,executed:false,published:false,
 providerMessagesSent:false,financialStateChanged:false,
});
const parse=(x:unknown)=>parseOwnerOpportunityPreview(x,{workspaceId:ws,branchId:branch});
describe("F12 browser-proof: signed-in saved signal proposals only",()=>{
 it("permits two grounded future internal attention proposals",()=>{
  const r=parse(base());expect(r).not.toBeNull();
  expect(r?.suggestions.map(x=>x.module)).toEqual(["overview","requests"]);
  expect(r?.suggestions[0].count).toBe(2);
 });
 it("refuses cross-tenant, branch-spoofed, paid-model and execution claims",()=>{
  for(const change of [
   {workspaceId:"33333333-3333-4333-8333-333333333333"},
   {branchId:"33333333-3333-4333-8333-333333333333"},
   {modelInvoked:true},{saved:true},{executed:true},{published:true},
   {financialStateChanged:true},{providerMessagesSent:true},
   {state:"LIVE_AUTOMATION_COMPLETED"},{source:"SYNTHETIC_COUNT"},
  ])expect(parse({...base(),...change})).toBeNull();
 });
 it("rejects tampered rule semantics or unsupported actions, not just wrong type shape",()=>{
  for(const change of [
   {eventType:"INVOICE_PAID"},
   {target:"FUTURE_INVOICE_PAID"},
   {summaryKey:"SEND_WHATSAPP_TEMPLATE"},
   {severity:"INFO"},
   {published:true},{requiresOwnerApproval:false},
   {existingCasesProcessed:true},{savedCount:0},
   {savedCount:5.5},{savedCount:5001},
  ]){
   const x=base();x.suggestions=[{...x.suggestions[0],...change} as typeof x.suggestions[number]];
   expect(parse(x)).toBeNull();
  }
 });
 it("rejects duplicate, reversed and fabricated priority order",()=>{
  const a=base();a.suggestions=[a.suggestions[0],a.suggestions[0]];
  expect(parse(a)).toBeNull();
  const b=base();b.suggestions.reverse();expect(parse(b)).toBeNull();
  const c=base();c.inspectedPriorities=999;expect(parse(c)).toBeNull();
 });
 it("does not read getter-backed source properties or hidden send flags",()=>{
  const a=base();
  Object.defineProperty(a.suggestions[0],"savedCount",{get(){throw Error("getter");}});
  expect(parse(a)).toBeNull();
  const b=base();
  Object.defineProperty(b,"sentCustomerMessage",{value:true,enumerable:false});
  expect(parse(b)).toBeNull();
  const c=base();
  Object.setPrototypeOf(c.suggestions[0],null);
  expect(parse(c)).toBeNull();
 });
 it("supports empty evidence without claiming an all-clear or inventing totals",()=>{
  const a=base();a.suggestions=[];a.inspectedPriorities=0;
  expect(parse(a)).toMatchObject({inspectedPriorities:0,suggestions:[]});
 });
});
