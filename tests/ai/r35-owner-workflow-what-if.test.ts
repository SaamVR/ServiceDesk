import {describe,expect,it} from "vitest";
import {previewOwnerWorkflowWhatIf} from "../../src/server/ai/workflow-what-if-preview";
const scope={workspaceId:"workspace-a",actorWorkspaceId:"workspace-a",
 branchId:"branch-a",role:"OWNER" as const};
const draft={eventType:"REQUEST_CREATED",serviceCode:"DEEP",severity:"WARNING"};
describe("SONIC L18 production-engine-powered AI rule preview (synthetic only)",()=>{
 it("matches a fictional DEEP request and safely explains one internal action",()=>{
  expect(previewOwnerWorkflowWhatIf(draft,scope,{serviceCode:"DEEP"}))
   .toMatchObject({ok:true,value:{state:"SYNTHETIC_RULE_PREVIEW_ONLY",
     inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT",
     matched:true,conditionCount:1,wouldCreateAttention:true,
     executed:false,published:false,customerMessaged:false,
     paymentChanged:false,ownerPublishStillRequired:true,
   }});
 });
 it("does not match an unknown/mismatched service and never invents live actions",()=>{
  for(const sample of [{},{serviceCode:"STANDARD" as const}]){
   expect(previewOwnerWorkflowWhatIf(draft,scope,sample))
     .toMatchObject({ok:true,value:{matched:false,wouldCreateAttention:false}});
  }
 });
 it("accepts no external send or payment even if the model asks for it",()=>{
  for(const malicious of [
   {...draft,recipient:"CUSTOMER_PRIMARY"},
   {...draft,action:"SEND_EMAIL_TEMPLATE"},
   {...draft,amountMinor:999},
   {eventType:"REQUEST_CREATED",severity:"BAD"},
  ])expect(previewOwnerWorkflowWhatIf(malicious,scope,{}))
    .toMatchObject({ok:false,code:"WORKFLOW_WHAT_IF_INVALID"});
 });
 it("requires authorized owner and matching workspace/branch",()=>{
  expect(previewOwnerWorkflowWhatIf(draft,{...scope,role:"DISPATCHER"},{}))
    .toMatchObject({ok:false,code:"WORKFLOW_WHAT_IF_INVALID"});
  expect(previewOwnerWorkflowWhatIf(draft,{...scope,actorWorkspaceId:"other"},{}))
    .toMatchObject({ok:false,code:"WORKFLOW_WHAT_IF_INVALID"});
 });
 it("rejects forged what-if snapshots with hidden or unknown business claims",()=>{
  const hidden=Object.defineProperty({serviceCode:"DEEP"},"paymentPaid",{
    value:true,enumerable:false,
  });
  expect(previewOwnerWorkflowWhatIf(draft,scope,hidden))
    .toMatchObject({ok:false,code:"WORKFLOW_WHAT_IF_INVALID"});
  expect(previewOwnerWorkflowWhatIf(draft,scope,{...hidden,paymentPaid:true} as never))
    .toMatchObject({ok:false,code:"WORKFLOW_WHAT_IF_INVALID"});
 });
});
