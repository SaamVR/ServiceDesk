import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {compileModelWorkflowDraft} from "../../src/server/ai/workflow-draft-proposal";
import {previewOwnerWorkflowWhatIf} from "../../src/server/ai/workflow-what-if-preview";
import {parseOwnerOpportunityPreview} from "../../src/features/operations/owner-opportunity-preview-proof";

const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const scope={workspaceId:ws,actorWorkspaceId:ws,branchId:branch,role:"OWNER" as const};
const proof={workspaceId:ws,branchId:branch};
const signedResult=()=>({
 ok:true,state:"OWNER_OPPORTUNITY_REVIEW_ONLY",
 source:"DOUBLE_CHECKED_OWNER_WORKDAY_AND_ACTIVE_WORKSPACE_BRANCH",
 workspaceId:ws,branchId:branch,inspectedPriorities:1,
 suggestions:[{evidenceKey:"OPEN_REQUEST",savedCount:4,target:"FUTURE_REQUEST_CREATED",
  eventType:"REQUEST_CREATED",severity:"WARNING",summaryKey:"AI_REVIEW_NEW_REQUEST",
  existingCasesProcessed:false,published:false,requiresOwnerApproval:true}],
 modelInvoked:false,saved:false,executed:false,published:false,
 providerMessagesSent:false,financialStateChanged:false,
});
describe("F12 crosslane critic: owner backlog to existing engine and browser truth",()=>{
 it("compiles only supported internal attentions and matches source-only browser projection",()=>{
  const raw=signedResult();
  const parsed=parseOwnerOpportunityPreview(raw,proof);
  expect(parsed?.suggestions).toHaveLength(1);
  const approved=parsed!.suggestions[0];
  const draft=compileModelWorkflowDraft({
   eventType:approved.eventType,severity:approved.severity,
  },scope);
  expect(draft.ok).toBe(true);
  if(!draft.ok)return;
  expect(draft.value).toMatchObject({
   state:"DRAFT_REQUIRES_OWNER_REVIEW",published:false,previewOnly:true,
   sendsCustomerMessages:false,mutatesFinancialState:false,
   actions:[{type:"CREATE_ATTENTION",summaryKey:"AI_REVIEW_NEW_REQUEST"}],
  });
  const whatif=previewOwnerWorkflowWhatIf({
   eventType:approved.eventType,severity:approved.severity,
  },scope,{});
  expect(whatif).toMatchObject({ok:true,value:{
   state:"SYNTHETIC_RULE_PREVIEW_ONLY",inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT",
   executed:false,published:false,customerMessaged:false,paymentChanged:false,
   ownerPublishStillRequired:true,
  }});
 });
 it("rejects forged cross-tenant response, false success receipts and arbitrary model actions",()=>{
  const base=signedResult();
  expect(parseOwnerOpportunityPreview({...base,workspaceId:branch},proof)).toBeNull();
  expect(parseOwnerOpportunityPreview({...base,executed:true},proof)).toBeNull();
  expect(parseOwnerOpportunityPreview({...base,saved:true},proof)).toBeNull();
  expect(parseOwnerOpportunityPreview({...base,suggestions:[{
   ...base.suggestions[0],summaryKey:"SEND_EMAIL_TEMPLATE",
  }]},proof)).toBeNull();
  expect(compileModelWorkflowDraft({
   eventType:"REQUEST_CREATED",severity:"WARNING",sendEmail:true,
  },scope).ok).toBe(false);
 });
 it("staff cannot compile a workflow, and static previews never claim source events",()=>{
  const staff={...scope,role:"STAFF" as const};
  expect(compileModelWorkflowDraft({eventType:"REQUEST_CREATED",severity:"WARNING"},staff).ok).toBe(false);
  expect(previewOwnerWorkflowWhatIf({eventType:"REQUEST_CREATED",severity:"WARNING"},
   staff,{}).ok).toBe(false);
 });
 it("keeps the new route lightweight: actor scope only, no full operational snapshot",()=>{
  const path="src/app/app/[workspace]/automations/opportunities/page.tsx";
  const route=readFileSync(path,"utf8");
  expect(route).toContain("resolveStaffActor(workspace)");
  expect(route).not.toContain("loadOperationalStaffSnapshot");
  expect(route).toContain('actor.role==="OWNER"');
 });

});
