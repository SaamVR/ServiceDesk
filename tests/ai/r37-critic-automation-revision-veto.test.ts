import {describe,expect,it} from "vitest";
import {reviewAutomationRevision} from "../../src/server/ai/automation-revision-review";
import type {WorkflowRuleVersionDTO} from "../../src/contracts";
const draft:WorkflowRuleVersionDTO={
 id:"version-1",ruleId:"rule-1",workspaceId:"workspace-1",branchId:"branch-1",
 versionNumber:1,state:"DRAFT",eventType:"REQUEST_CREATED",
 conditions:[],actions:[{type:"CREATE_ATTENTION",severity:"WARNING",
   summaryKey:"REVIEW_REQUEST"}],maxActionsPerEvent:3,
 createdAt:"2026-10-18T00:00:00.000Z",
};
const input={actor:{workspaceId:"workspace-1",role:"OWNER" as const},
 workspaceId:"workspace-1",branchId:"branch-1",previous:null,draft};
describe("R37 independent critic: model-proposed automation revision integrity",()=>{
 it("rejects unexpected published/privileged authority fields rather than silently ignoring them",()=>{
  const forge={...draft,permissionGranted:true};
  expect(reviewAutomationRevision({...input,draft:forge}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
 });
 it("refuses duplicated identical customer-send actions even if owner can approve later",()=>{
  const send={type:"SEND_EMAIL_TEMPLATE" as const,
    templateKey:"customer-followup",recipient:"CUSTOMER_PRIMARY" as const};
  const forged:WorkflowRuleVersionDTO={...draft,actions:[send,send]};
  expect(reviewAutomationRevision({...input,draft:forged}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
 });
});
