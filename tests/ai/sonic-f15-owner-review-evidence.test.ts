import {describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {readF15OwnerSavedReviewEvidence} from "../../src/server/workflows/sonic-f15-owner-review-evidence";
const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const request="33333333-3333-4333-8333-333333333333";
const owner=async()=>({workspaceId:ws,branchIds:[branch],service:{} as never});
const row=()=>({workspace_id:ws,branch_id:branch,request_id:request,
 state:"OWNER_REVIEW_REQUIRED",source_version:2,recorded_at:"2026-10-30T00:00:00Z"});
describe("F15 owner source journal independent persistent readback",()=>{
 it("reads a real selected saved row and never calls a provider or payment API",async()=>{
  const lookup=vi.fn(async()=>[row()]);
  expect(await readF15OwnerSavedReviewEvidence("workspace",branch,request,{
   resolveOwner:owner,readRows:lookup,
  })).toEqual({state:"SAVED_OWNER_REVIEW_CONFIRMED",count:1,
   latestAt:"2026-10-30T00:00:00Z",humanApprovalRequired:true,
   workflowExecuted:false,customerMessaged:false});
  expect(lookup).toHaveBeenCalledTimes(1);
 });
 it("returns honest empty only on an independently verified empty source",async()=>{
  expect(await readF15OwnerSavedReviewEvidence("workspace",branch,request,{
   resolveOwner:owner,readRows:async()=>[],
  })).toEqual({state:"NO_REVIEW_RECORDED",count:0});
  expect(await readF15OwnerSavedReviewEvidence("workspace",branch,request,{
   resolveOwner:owner,readRows:async()=>null,
  })).toEqual({state:"UNAVAILABLE"});
 });
 it("denies foreign branch, tenant and forged rows",async()=>{
  const readRows=vi.fn(async()=>[row()]);
  expect(await readF15OwnerSavedReviewEvidence("workspace",
   "44444444-4444-4444-8444-444444444444",request,{
    resolveOwner:owner,readRows,
   })).toEqual({state:"UNAVAILABLE"});
  expect(readRows).not.toHaveBeenCalled();
  for(const bad of [{...row(),workspace_id:branch},
   {...row(),state:"SUCCEEDED"},{...row(),source_version:-1},
   {...row(),recorded_at:"n/a"}]){
    expect(await readF15OwnerSavedReviewEvidence("workspace",branch,request,{
     resolveOwner:owner,readRows:async()=>[bad],
    })).toEqual({state:"UNAVAILABLE"});
  }
 });
 it("fails closed for a 26th record, never claims a truncated historical journal",async()=>{
  expect(await readF15OwnerSavedReviewEvidence("workspace",branch,request,{
   resolveOwner:owner,readRows:async()=>Array(26).fill(row()),
  })).toEqual({state:"UNAVAILABLE"});
 });
 it("uses tenant-scoped DB query and does not return source IDs or customer text",()=>{
  const src=readFileSync("src/server/workflows/sonic-f15-owner-review-evidence.ts","utf8");
  const ui=readFileSync("src/features/operations/OwnerUnansweredLeadReview.tsx","utf8");
  const action=readFileSync("src/features/operations/f15-owner-lead-sla-action.ts","utf8");
  expect(src).toContain('.from("f15_unanswered_lead_reviews")');
  for(const p of ['.eq("workspace_id",workspaceId)', '.eq("branch_id",branchId)',
   '.eq("request_id",requestId)', '.limit(26)'])expect(src).toContain(p);
  expect(action).toContain('"use server"');
  expect(ui).toContain("requestF15OwnerReviewEvidence(slug,branchId,requestId)");
  expect(ui).toContain("Read saved owner-review journal");
  for(const forbidden of ["sendEmail(","sendWhatsApp(","processPayment(","createPayment(","callModel("])
    expect(src+action+ui).not.toContain(forbidden);
 });
});