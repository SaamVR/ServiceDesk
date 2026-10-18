import {describe,expect,it} from "vitest";
import {reviewAutomationRevision} from "../../src/server/ai/automation-revision-review";
import type {WorkflowRuleVersionDTO} from "../../src/contracts";
const actor={workspaceId:"workspace-1",role:"OWNER" as const};
const old:WorkflowRuleVersionDTO={
 id:"ver-1",ruleId:"rule-1",workspaceId:"workspace-1",branchId:"branch-1",
 versionNumber:1,state:"PUBLISHED",eventType:"REQUEST_CREATED",
 conditions:[{field:"request.serviceCode",operator:"EQ",value:"DEEP"}],
 actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"NEEDS_REVIEW"}],
 maxActionsPerEvent:2,createdAt:"2026-10-18T00:00:00.000Z",
};
const draft:WorkflowRuleVersionDTO={...old,id:"ver-2",state:"DRAFT",
 versionNumber:2,basedOnVersionNumber:1};
const input={actor,workspaceId:"workspace-1",branchId:"branch-1",previous:old,draft};
describe("SONIC R37 AI-E audited automation revision diff",()=>{
 it("recognizes unchanged owner draft and never pretends it is published",()=>{
  expect(reviewAutomationRevision(input)).toMatchObject({ok:true,value:{
    changes:[],hasChanges:false,published:false,executed:false,
    customerMessaged:false,requiresExplicitExternalApproval:false,
  }});
 });
 it("detects customer send added and keeps explicit owner approval gate",()=>{
  const changed={...draft,actions:[...draft.actions,{
    type:"SEND_EMAIL_TEMPLATE" as const,templateKey:"request-received",
    recipient:"CUSTOMER_PRIMARY" as const,
  }]};
  const r=reviewAutomationRevision({...input,draft:changed});
  expect(r).toMatchObject({ok:true,value:{
    changes:["ACTIONS_CHANGED","EXTERNAL_SEND_INTRODUCED"],
    externalActionCount:1,requiresExplicitExternalApproval:true,
    published:false,customerMessaged:false,
  }});
 });
 it("rejects stale based-on published version and cross-workspace edits",()=>{
  expect(reviewAutomationRevision({...input,draft:{...draft,basedOnVersionNumber:0}}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_VERSION_CONFLICT"});
  expect(reviewAutomationRevision({...input,draft:{...draft,workspaceId:"workspace-2"}}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
  expect(reviewAutomationRevision({...input,actor:{workspaceId:"workspace-1",role:"DISPATCHER"}}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_OWNER_REQUIRED"});
 });
 it("rejects model-generated external actions carrying arbitrary URL, SQL or hidden fields",()=>{
  const bad=Object.defineProperty({type:"SEND_EMAIL_TEMPLATE",
    recipient:"CUSTOMER_PRIMARY",templateKey:"request-received"},
    "webhookUrl",{value:"https://attacker.test",enumerable:false});
  expect(reviewAutomationRevision({...input,draft:{...draft,actions:[bad as never]}}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
  expect(reviewAutomationRevision({...input,draft:{...draft,actions:[{
    type:"EXECUTE_SQL",sql:"DROP TABLE"} as never]}}))
    .toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
 });
});
