import {beforeEach,describe,expect,it,vi} from "vitest";
import {previewOwnerAutomationStarters} from "../../src/features/operations/owner-starter-batch-preview-action";
import {prepareAuthorizedAutomationStarterBatch} from "../../src/server/ai/owner-starter-batch";

vi.mock("../../src/server/ai/owner-starter-batch",()=>({
 prepareAuthorizedAutomationStarterBatch:vi.fn(),
}));
const branchId="22222222-2222-4222-8222-222222222222";
const request={workspaceSlug:"qa-cleaning",branchId,starterIds:["new-enquiry"]};
const fixture=()=>({
 ok:true,value:{
   state:"OWNER_STARTER_DRAFT_BATCH_REQUIRES_REVIEW",
   source:"TRUSTED_27_STARTER_CATALOG_SAVED_BRANCH",
   workspaceId:"11111111-1111-4111-8111-111111111111",branchId,
   selectedCount:1,ownerPublishRequired:true,
   persisted:false,published:false,executed:false,modelInvoked:false,
   providerMessagesSent:false,paymentChanged:false,
   drafts:[{
    state:"UNPERSISTED_OWNER_RULE_DRAFT",starterId:"new-enquiry",
    code:"NEW_ENQUIRY_REVIEW",eventType:"REQUEST_CREATED",conditions:[],
    actions:[{type:"CREATE_ATTENTION",severity:"WARNING",
      summaryKey:"REVIEW_NEW_ENQUIRY"}],
    maxActionsPerEvent:1,requiresOwnerReview:true,
    persisted:false,published:false,providerMessagesSent:false,paymentChanged:false,
   }],
 },
});
describe("R49 independent critic: bound batch preview to exact safe catalogue evidence",()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.mocked(prepareAuthorizedAutomationStarterBatch)
   .mockResolvedValue(fixture() as never);});
 it("accepts one exact selected internal starter without live status",async()=>{
  expect(await previewOwnerAutomationStarters(request)).toMatchObject({
   ok:true,state:"OWNER_STARTER_BATCH_PREVIEW_ONLY",
   drafts:[{starterId:"new-enquiry",persisted:false,published:false,executed:false}],
   providerMessagesSent:false,paidModelInvoked:false,
  });
 });
 it("rejects backend returning a different recipe ID, duplicate or unrequested second entry",async()=>{
  for(const candidate of [
    {drafts:[{...fixture().value.drafts[0],starterId:"different-starter"}]},
    {selectedCount:2,drafts:[fixture().value.drafts[0],fixture().value.drafts[0]]},
  ]){
    vi.mocked(prepareAuthorizedAutomationStarterBatch).mockResolvedValueOnce({
      ...fixture(),value:{...fixture().value,...candidate},
    } as never);
    expect(await previewOwnerAutomationStarters(request))
     .toEqual({ok:false,state:"OWNER_STARTER_PREVIEW_UNAVAILABLE"});
  }
 });
 it("rejects nested model/customer values instead of serializing them to the browser",async()=>{
  const candidate=fixture();
  candidate.value.drafts[0].conditions=[
    {field:"request.serviceCode",operator:"EQ",
     value:{privateCustomerEmail:"private@example.test"}},
  ] as never;
  vi.mocked(prepareAuthorizedAutomationStarterBatch)
    .mockResolvedValueOnce(candidate as never);
  expect(await previewOwnerAutomationStarters(request))
   .toEqual({ok:false,state:"OWNER_STARTER_PREVIEW_UNAVAILABLE"});
 });
 it("refuses proposed publication or missing owner review flag even if action says internal",async()=>{
  for(const changed of [
   {ownerPublishRequired:false},
   {drafts:[{...fixture().value.drafts[0],requiresOwnerReview:false}]},
   {drafts:[{...fixture().value.drafts[0],state:"PUBLISHED"}]},
  ]){
   vi.mocked(prepareAuthorizedAutomationStarterBatch).mockResolvedValueOnce({
    ...fixture(),value:{...fixture().value,...changed},
   } as never);
   expect(await previewOwnerAutomationStarters(request))
    .toEqual({ok:false,state:"OWNER_STARTER_PREVIEW_UNAVAILABLE"});
  }
 });
});
