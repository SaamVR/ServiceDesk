import {beforeEach,describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {requestOwnerVerifiedWorkdayReview}
 from "../../src/features/operations/owner-verified-workday-action";
import {loadOwnerWorkdayPriorities}
 from "../../src/server/ai/owner-workday-priorities";

vi.mock("../../src/server/ai/owner-workday-priorities",()=>({
 loadOwnerWorkdayPriorities:vi.fn(),
}));
const ok=()=>({ok:true,value:{
 state:"VERIFIED_OWNER_WORKDAY_REVIEW",
 source:"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
 workspaceId:"private-owner-workspace",
 facts:{openRequests:1},
 priorities:[{
   key:"OPEN_REQUEST",count:1,module:"requests",priority:"NORMAL",
   label:"Open service requests to qualify",
   instruction:"Inspect persisted intake manually.",
   source:"VERIFIED_SAVED_QUEUE_COUNT",
   customerEmail:"private@example.test",
 }],
 attentionSla:{state:"SAVED_ATTENTION_SLA_OWNER_REVIEW",
   overdueCount:2,unscheduledCount:0,
   workflowExecuted:false,customerMessaged:false,
   overdue:[{attentionId:"private-attention-one",dueAt:"2026-10-25T00:00:00Z"}],
 },
 manualReviewRequired:true,modelInvoked:false,
 providerMessageSent:false,paymentChanged:false,
 internalApiKey:"secret-never-cross",
}});
const text=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
describe("R50 model-free owner verified workday",()=>{
 beforeEach(()=>{vi.resetAllMocks();
  vi.mocked(loadOwnerWorkdayPriorities).mockResolvedValue(ok() as never);
 });
 it("projects only bounded queue count and manual navigation with zero models or sends",async()=>{
  const r=await requestOwnerVerifiedWorkdayReview("qa-cleaning");
  expect(r).toMatchObject({ok:true,
   state:"SAVED_WORKDAY_REVIEW_ONLY",
   priorities:[{key:"OPEN_REQUEST",count:1,module:"requests"}],
   overdueCount:2,unscheduledCount:0,manualReviewRequired:true,
   modelInvoked:false,workflowExecuted:false,
   customerMessaged:false,paymentChanged:false,
  });
  const serialized=JSON.stringify(r);
  for(const value of ["private-attention-one","private-owner-workspace",
    "private@example.test","secret-never-cross"]){
   expect(serialized).not.toContain(value);
  }
  expect(loadOwnerWorkdayPriorities).toHaveBeenCalledExactlyOnceWith("qa-cleaning");
 });
 it("denies invalid slugs before any source loader",async()=>{
  for(const value of ["", "../other", "workspace user", "X".repeat(50)]){
   expect(await requestOwnerVerifiedWorkdayReview(value))
    .toMatchObject({ok:false,state:"SAVED_WORKDAY_UNAVAILABLE"});
  }
  expect(loadOwnerWorkdayPriorities).not.toHaveBeenCalled();
 });
 it("fails closed on spoofed provider/automation flags or unverified source state",async()=>{
  for(const patch of [
   {modelInvoked:true},{providerMessageSent:true},{paymentChanged:true},
   {manualReviewRequired:false},
   {attentionSla:{...ok().value.attentionSla,workflowExecuted:true}},
   {attentionSla:{...ok().value.attentionSla,customerMessaged:true}},
   {source:"MODEL_SUGGESTION_ONLY"},
  ]){
   vi.mocked(loadOwnerWorkdayPriorities).mockResolvedValueOnce({
    ...ok(),value:{...ok().value,...patch},
   } as never);
   expect(await requestOwnerVerifiedWorkdayReview("qa-cleaning"))
    .toEqual({ok:false,state:"SAVED_WORKDAY_UNAVAILABLE"});
  }
 });
 it("does not render arbitrary PII or paid model results in model-free owner UI",()=>{
  const parent=text("src/features/operations/AiOwnerOperationsBrief.tsx");
  const child=text("src/features/operations/OwnerVerifiedWorkdayReview.tsx");
  const styles=text("src/features/operations/OwnerVerifiedWorkdayReview.module.css");
  expect(parent).toContain("<OwnerVerifiedWorkdayReview workspaceSlug={workspaceSlug}");
  expect(child).toContain("parseVerifiedOwnerPriorityActions(response.priorities)");
  expect(child).toContain("requestOwnerVerifiedWorkdayReview(workspaceSlug)");
  expect(child).toContain("WAIT_MS=30_000");
  expect(child).toContain("A repeat request is blocked until it finishes");
  expect(child).toContain("This saved-source review is taking longer");
  expect(child).not.toContain("callAiModel(");
  expect(child).not.toContain("publishOperationalWorkflowVersion(");
  expect(styles).toContain("min-height:44px");
  expect(styles).toContain(":focus-visible");
 });
});
