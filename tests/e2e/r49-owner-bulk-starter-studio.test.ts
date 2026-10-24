import {beforeEach,describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {previewOwnerAutomationStarters} from "../../src/features/operations/owner-starter-batch-preview-action";
import {prepareAuthorizedAutomationStarterBatch} from "../../src/server/ai/owner-starter-batch";

vi.mock("../../src/server/ai/owner-starter-batch",()=>({
 prepareAuthorizedAutomationStarterBatch:vi.fn(),
}));
const wid="11111111-1111-4111-8111-111111111111";
const bid="22222222-2222-4222-8222-222222222222";
const request={workspaceSlug:"test-cleaner",branchId:bid,starterIds:["quote-accepted"]};
const saved=()=>({
 ok:true,value:{
   state:"OWNER_STARTER_DRAFT_BATCH_REQUIRES_REVIEW",
   source:"TRUSTED_27_STARTER_CATALOG_SAVED_BRANCH",
   workspaceId:wid,branchId:bid,selectedCount:1,
   drafts:[{
     starterId:"quote-accepted",code:"QUOTE_ACCEPTED_DISPATCH",
     eventType:"QUOTE_ACCEPTED",conditions:[],
     actions:[{type:"CREATE_ATTENTION",severity:"WARNING",
       summaryKey:"CHECK_CREW_ASSIGNMENT"}],
     maxActionsPerEvent:1,requiresOwnerReview:true,
     persisted:false,published:false,providerMessagesSent:false,paymentChanged:false,
     privateContact:"must-not-cross",
   }],
   ownerPublishRequired:true,persisted:false,published:false,
   executed:false,modelInvoked:false,providerMessagesSent:false,paymentChanged:false,
   secretToken:"must-not-cross",
 },
});
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");

describe("R49 owner bulk starter workbench: human-only source boundary",()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.mocked(prepareAuthorizedAutomationStarterBatch)
   .mockResolvedValue(saved() as never);});
 it("previews only validated internal attention and explicitly projects out hidden source data",async()=>{
   const outcome=await previewOwnerAutomationStarters(request);
   expect(outcome).toMatchObject({
     ok:true,state:"OWNER_STARTER_BATCH_PREVIEW_ONLY",
     workspaceId:wid,branchId:bid,selectedCount:1,
     drafts:[{starterId:"quote-accepted",actions:[{type:"CREATE_ATTENTION"}],
       persisted:false,published:false,executed:false}],
     ownerReviewRequired:true,persisted:false,published:false,
     executed:false,paidModelInvoked:false,providerMessagesSent:false,
     paymentChanged:false,
   });
   const text=JSON.stringify(outcome);
   expect(text).not.toContain("must-not-cross");
   expect(prepareAuthorizedAutomationStarterBatch).toHaveBeenCalledExactlyOnceWith(
     request.workspaceSlug,bid,request.starterIds);
 });
 it("fails closed on tenant scope mismatch, spoofed live or paid provider receipts",async()=>{
   for(const replacement of [
     {branchId:"foreign"}, {modelInvoked:true},{providerMessagesSent:true},
     {paymentChanged:true},{persisted:true},{published:true},{executed:true},
     {selectedCount:2}, {drafts:[]},
   ]){
     vi.mocked(prepareAuthorizedAutomationStarterBatch).mockResolvedValueOnce({
       ...saved(),value:{...saved().value,...replacement},
     } as never);
     expect(await previewOwnerAutomationStarters(request)).toEqual({
       ok:false,state:"OWNER_STARTER_PREVIEW_UNAVAILABLE",
     });
   }
 });
 it("rejects malicious action substitution, wrong severity or one-off source failure",async()=>{
   for(const action of [
     {type:"SEND_WHATSAPP_TEMPLATE",recipient:"CUSTOMER_PRIMARY",summaryKey:"PRIVATE"},
     {type:"CREATE_ATTENTION",severity:"ADMIN",summaryKey:"CHECK_CREW_ASSIGNMENT"},
     {type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"bad contact"},
   ]){
     const candidate=saved();
     candidate.value.drafts[0].actions=[action] as never;
     vi.mocked(prepareAuthorizedAutomationStarterBatch)
       .mockResolvedValueOnce(candidate as never);
     expect(await previewOwnerAutomationStarters(request)).toEqual({
       ok:false,state:"OWNER_STARTER_PREVIEW_UNAVAILABLE",
     });
   }
   vi.mocked(prepareAuthorizedAutomationStarterBatch).mockRejectedValueOnce(
     Error("database private token"));
   expect(await previewOwnerAutomationStarters(request)).toEqual({
     ok:false,state:"OWNER_STARTER_PREVIEW_UNAVAILABLE",
   });
 });
 it("blocks invalid workspace or branch before authorization reader",async()=>{
   for(const params of [
     {...request,workspaceSlug:"../../foreign"},
     {...request,branchId:"foreign"},
     {...request,workspaceSlug:""},
   ]){
     expect(await previewOwnerAutomationStarters(params)).toEqual({
       ok:false,state:"OWNER_STARTER_PREVIEW_UNAVAILABLE",
     });
   }
   expect(prepareAuthorizedAutomationStarterBatch).not.toHaveBeenCalled();
 });
 it("renders owner-only, keyboard-usable static batch UI without model or external effects",()=>{
   const parent=read("src/features/operations/OwnerAutomationActivationChecklist.tsx");
   const ui=read("src/features/operations/OwnerStarterBatchWorkbench.tsx");
   const action=read("src/features/operations/owner-starter-batch-preview-action.ts");
   const css=read("src/features/operations/OwnerStarterBatchWorkbench.module.css");
   expect(parent).toContain('data.actor?.role === "OWNER" ? <OwnerStarterBatchWorkbench');
   expect(ui).toContain("values.length>=12");
   expect(ui).toContain("pending.current");
   expect(ui).toContain("requestSequence.current");
   expect(ui).toContain("previewOwnerAutomationStarters({");
   expect(ui).toContain("No business action ran.");
   expect(ui).toContain("never a published automation");
   expect(action).toContain("prepareAuthorizedAutomationStarterBatch(");
   expect(action).not.toContain("publishOperationalWorkflowVersion(");
   expect(action).not.toContain("saveOperationalWorkflowDraft(");
   expect(ui).not.toContain("fetch(");
   expect(ui).not.toContain("sendCustomerMessage(");
   expect(css).toContain("min-height:44px");
   expect(css).toContain(":focus-visible");
   expect(css).toContain("prefers-reduced-motion:reduce");
 });
});
