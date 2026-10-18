import {describe,expect,it} from "vitest";
import {prepareAuthorizedAutomationStarterBatch,type AutomationDraftBatchDependencies}
 from "../../src/server/ai/owner-starter-batch";
const wid="11111111-1111-4111-8111-111111111111";
const bid="22222222-2222-4222-8222-222222222222";
function deps(mode:"normal"|"revoked"|"branch-outage"="normal"){
 let n=0;
 const obj={
  resolveActor:async()=>{n++;return {ok:true,value:{
   workspace:{id:wid,slug:"qa-cleaning"},
   actor:{workspaceId:wid,userId:"owner-a",role:mode==="revoked"&&n===2?"CREW":"OWNER"},
   service:{},
  }};},
  verifyBranch:async()=>{
   if(mode==="branch-outage")throw Error("private DB error");
   return true;
  },
 } as unknown as AutomationDraftBatchDependencies;
 return {obj,reads:()=>n};
}
describe("SONIC R42 L21 multi-starter human reviewed automation",()=>{
 it("produces multiple catalog-backed internal attention drafts without persistence or sends",async()=>{
  const d=deps();
  const result=await prepareAuthorizedAutomationStarterBatch("qa-cleaning",bid,
   ["new-enquiry","quote-accepted","deep-enquiry"],d.obj);
  expect(result).toMatchObject({ok:true,value:{
   state:"OWNER_STARTER_DRAFT_BATCH_REQUIRES_REVIEW",selectedCount:3,
   published:false,executed:false,modelInvoked:false,providerMessagesSent:false,
   drafts:[
    {starterId:"new-enquiry",eventType:"REQUEST_CREATED",actions:[{type:"CREATE_ATTENTION"}],
     persisted:false,requiresOwnerReview:true},
    {starterId:"quote-accepted",eventType:"QUOTE_ACCEPTED",actions:[{type:"CREATE_ATTENTION"}]},
    {starterId:"deep-enquiry",eventType:"REQUEST_CREATED",
     conditions:[{field:"request.serviceCode",operator:"EQ",value:"DEEP"}]},
   ]}});
  expect(d.reads()).toBe(2);
 });
 it("refuses duplicate, nonexistent, sparse or over-cap selection before any owner lookup",async()=>{
  const d=deps();
  for(const ids of [
   ["new-enquiry","new-enquiry"],["missing-starter"],
   Array.from({length:13},()=>"new-enquiry"),
   ["new-enquiry",,"quote-accepted"],[],
  ])expect((await prepareAuthorizedAutomationStarterBatch("qa-cleaning",bid,ids,d.obj)).ok).toBe(false);
  expect(d.reads()).toBe(0);
 });
 it("fails closed on revoked owner or branch verification outage",async()=>{
  for(const mode of ["revoked","branch-outage"] as const){
   const d=deps(mode),r=await prepareAuthorizedAutomationStarterBatch("qa-cleaning",bid,["new-enquiry"],d.obj);
   expect(r.ok).toBe(false);
  }
 });
 it("never turns a starter into external-send or published-rule receipt",async()=>{
  const result=await prepareAuthorizedAutomationStarterBatch("qa-cleaning",bid,
   ["new-enquiry","website-lead","quote-accepted"],deps().obj);
  expect(result.ok).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/SEND_EMAIL_TEMPLATE|SEND_WHATSAPP_TEMPLATE|PROVIDER_DELIVERED/);
 });
});
