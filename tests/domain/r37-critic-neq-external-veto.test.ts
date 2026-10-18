import {describe,expect,it} from "vitest";
import {evaluateWorkflowRule} from "../../src/server/workflows/engine";
import type {WorkflowRuleVersionDTO} from "../../src/contracts";
const version:WorkflowRuleVersionDTO={
 id:"version-1",workspaceId:"workspace-1",branchId:"branch-1",
 ruleId:"rule-1",versionNumber:1,state:"PUBLISHED",eventType:"QUOTE_ACCEPTED",
 conditions:[{field:"quote.currency",operator:"NEQ",value:"USD"}],
 actions:[{type:"SEND_EMAIL_TEMPLATE",templateKey:"quote-followup",
   recipient:"CUSTOMER_PRIMARY"}],
 maxActionsPerEvent:1,createdAt:"2026-10-18T00:00:00.000Z",
};
const event={workspaceId:"workspace-1",branchId:"branch-1",
 eventType:"QUOTE_ACCEPTED" as const,sourceEventId:"quote-source-1",
 recursionDepth:0,snapshot:{"quote.currency":"EUR"}};
describe("R37 independent critic: ambiguous NEQ cannot create provider-send approval",()=>{
 it("keeps a valid non-USD saved scalar awaiting owner authorization",()=>{
  expect(evaluateWorkflowRule(version,event,"LIVE")).toMatchObject({
   ok:true,value:{matched:true,actionPlans:[{
    requiresOwnerApproval:true,previewOnly:false,
    action:{type:"SEND_EMAIL_TEMPLATE"},
   }]},
  });
 });
 it("blocks a mixed USD/EUR saved event instead of proposing an external message",()=>{
  for(const value of [["USD","EUR"],["USD"],["EUR"],[]]){
    const r=evaluateWorkflowRule(version,{...event,snapshot:{"quote.currency":value}},"LIVE");
    expect(r).toMatchObject({ok:true,value:{matched:false,actionPlans:[]}});
  }
 });
 it("does not infer a permitted currency from a missing quote source field",()=>{
  expect(evaluateWorkflowRule(version,{...event,snapshot:{}},"LIVE"))
   .toMatchObject({ok:true,value:{matched:false,actionPlans:[]}});
 });
});
