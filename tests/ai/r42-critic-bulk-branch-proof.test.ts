import {describe,expect,it} from "vitest";
import {prepareAuthorizedAutomationStarterBatch,type AutomationDraftBatchDependencies}
 from "../../src/server/ai/owner-starter-batch";
const wid="11111111-1111-4111-8111-111111111111",
 bid="22222222-2222-4222-8222-222222222222";
const source=()=>({
 resolveActor:async()=>({ok:true,value:{
  workspace:{id:wid,slug:"qa-cleaning"},
  actor:{workspaceId:wid,userId:"owner-a",role:"OWNER"},
  service:{},
 }}),
});
describe("Independent SONIC R42 critic — branch proof must be boolean true",()=>{
 it("rejects a truthy string from a poisoned branch verifier rather than creating rules",async()=>{
  const deps={...source(),verifyBranch:async()=>"yes"} as unknown as AutomationDraftBatchDependencies;
  const r=await prepareAuthorizedAutomationStarterBatch("qa-cleaning",bid,["new-enquiry"],deps);
  expect(r).toMatchObject({ok:false,code:"BATCH_BRANCH_UNVERIFIED"});
 });
 it("requires full post-read branch proof and never accepts revoked authority",async()=>{
  let n=0;
  const deps={...source(),verifyBranch:async()=>{
   n++;return n===1;
  }} as unknown as AutomationDraftBatchDependencies;
  const r=await prepareAuthorizedAutomationStarterBatch("qa-cleaning",bid,["new-enquiry"],deps);
  expect(r).toMatchObject({ok:false,code:"BATCH_ACCESS_CHANGED"});
  expect(n).toBe(2);
 });
});
