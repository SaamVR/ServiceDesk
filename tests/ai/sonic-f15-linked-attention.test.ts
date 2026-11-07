import {describe,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
import {readF15OwnerLinkedAttentionProof}
 from "../../src/server/workflows/sonic-f15-owner-linked-attention";
const workspaceId="11111111-1111-4111-8111-111111111111";
const actorId="66666666-6666-4666-8666-666666666666";
const branchId="22222222-2222-4222-8222-222222222222";
const requestId="33333333-3333-4333-8333-333333333333";
const reviewId="44444444-4444-4444-8444-444444444444";
const attentionId="55555555-5555-4555-8555-555555555555";
const context=()=>({workspaceId,actorId,branches:[branchId],service:{} as never});
const review=()=>({id:reviewId,workspace_id:workspaceId,branch_id:branchId,
 request_id:requestId,source_version:2,state:"OWNER_REVIEW_REQUIRED",
 recorded_at:"2026-10-30T00:00:00.000Z"});
const item=()=>({id:attentionId,workspace_id:workspaceId,type:"UNANSWERED_LEAD_SLA",
 resource_type:"f15_unanswered_lead_review",resource_id:reviewId,
 severity:"WARNING",status:"OPEN"});
const deps=()=>({resolve:vi.fn(async()=>context()),
 journal:vi.fn(async()=>[review()]),attention:vi.fn(async()=>[item()])});
describe("F15 V3 source journal -> saved Attention Center proof",()=>{
 it("verifies exactly one linked persisted internal attention, double owner reauth",async()=>{
  const injected=deps();
  expect(await readF15OwnerLinkedAttentionProof("workspace",branchId,requestId,injected))
   .toEqual({state:"LINKED_INTERNAL_ATTENTION_VERIFIED",count:1,open:1,
    acknowledged:0,resolved:0,humanReviewRequired:true,
    workflowExecuted:false,customerMessaged:false});
  expect(injected.resolve).toHaveBeenCalledTimes(2);
 });
 it("no successful claim for missing journal, missing attention or rogue tenant",async()=>{
  expect(await readF15OwnerLinkedAttentionProof("workspace",branchId,requestId,{
   ...deps(),journal:async()=>[],
  })).toEqual({state:"NO_REVIEW_RECORDED"});
  for(const wrong of [[{...item(),workspace_id:branchId}],[],
    [{...item(),resource_id:requestId}],
    [{...item(),status:"PENDING"}]]){
   expect(await readF15OwnerLinkedAttentionProof("workspace",branchId,requestId,{
    ...deps(),attention:async()=>wrong,
   })).toEqual({state:"UNAVAILABLE"});
  }
 });
 it("refuses duplicate attention, source overflow, revoked owner and foreign branch",async()=>{
  expect(await readF15OwnerLinkedAttentionProof("workspace",branchId,requestId,{
   ...deps(),attention:async()=>[item(),{...item(),id:reviewId}],
  })).toEqual({state:"UNAVAILABLE"});
  expect(await readF15OwnerLinkedAttentionProof("workspace",branchId,requestId,{
   ...deps(),journal:async()=>Array(26).fill(review()),
  })).toEqual({state:"UNAVAILABLE"});
  let calls=0;
  expect(await readF15OwnerLinkedAttentionProof("workspace",branchId,requestId,{
   ...deps(),resolve:async()=>++calls===1?context():null,
  })).toEqual({state:"UNAVAILABLE"});
  expect(await readF15OwnerLinkedAttentionProof("workspace",
   "99999999-9999-4999-8999-999999999999",requestId,deps()))
   .toEqual({state:"UNAVAILABLE"});
 });
 it("operator action is wired into existing selected Inbox, no sends and exact record joins",()=>{
  const panel=readFileSync("src/features/operations/InboxProtectedLeadReviewPanel.tsx","utf8");
  const action=readFileSync("src/features/operations/f15-owner-linked-attention-action.ts","utf8");
  const backend=readFileSync("src/server/workflows/sonic-f15-owner-linked-attention.ts","utf8");
  const client=readFileSync("src/features/operations/OwnerLinkedAttentionReview.tsx","utf8");
  expect(panel).toContain("<OwnerLinkedAttentionReview workspaceSlug={workspaceSlug}");
  expect(action).toContain('"use server"');
  expect(backend).toContain('.from("attention_items")');
  expect(backend).toContain('.in("resource_id",reviewIds)');
  expect(backend).toContain('row.resource_type!=="f15_unanswered_lead_review"');
  expect(backend).toContain('again.actorId!==first.actorId');
  expect(client).toContain("Verify saved internal attention");
  for(const forbidden of ["sendEmail(","sendWhatsApp(","createPayment(","runWorkflow(","process.env."]){
   expect(action+backend+client).not.toContain(forbidden);
  }
 });
});
