import {describe,expect,it} from "vitest";
import {evaluateWorkflowRule} from "../../src/server/workflows/engine";
import type {WorkflowRuleVersionDTO} from "../../src/contracts";
const version:WorkflowRuleVersionDTO={
 id:"version-1",ruleId:"rule-1",workspaceId:"workspace-1",branchId:"branch-1",
 versionNumber:1,state:"PUBLISHED",eventType:"VISIT_COMPLETED",
 conditions:[{field:"visit.hasIncident",operator:"NEQ",value:true}],
 actions:[{type:"CREATE_ATTENTION",severity:"CRITICAL",summaryKey:"NO_INCIDENT_AFTERCARE"}],
 maxActionsPerEvent:1,createdAt:"2026-10-18T00:00:00Z",
};
const event={
 workspaceId:"workspace-1",branchId:"branch-1",
 eventType:"VISIT_COMPLETED" as const,sourceEventId:"visit-abc",
 snapshot:{"visit.hasIncident":false},recursionDepth:0,
};
describe("SONIC R37 CORE: workflow NEQ must never infer certainty from a malformed array",()=>{
 it("runs a normal scalar not-equal rule on a verified false signal",()=>{
   expect(evaluateWorkflowRule(version,event,"LIVE"))
     .toMatchObject({ok:true,value:{matched:true,actionPlans:[{index:0}]}});
 });
 it("does not execute when source value is the denied scalar",()=>{
   expect(evaluateWorkflowRule(version,{...event,snapshot:{"visit.hasIncident":true}},"LIVE"))
     .toMatchObject({ok:true,value:{matched:false,actionPlans:[]}});
 });
 it("does not convert mixed or empty array into positive NEQ evidence",()=>{
  for(const value of [[true,false],[],[true],[false]]){
    const r=evaluateWorkflowRule(version,{...event,snapshot:{"visit.hasIncident":value}},"LIVE");
    expect(r).toMatchObject({ok:true,value:{matched:false,actionPlans:[]}});
  }
 });
 it("does not treat missing source fact as evidence that an incident did not happen",()=>{
  const r=evaluateWorkflowRule(version,{...event,snapshot:{}},"LIVE");
  expect(r).toMatchObject({ok:true,value:{matched:false,actionPlans:[]}});
 });
 it("still treats explicitly saved null as known, without treating unknown as false",()=>{
  const r=evaluateWorkflowRule(version,{...event,snapshot:{"visit.hasIncident":null}},"LIVE");
  expect(r).toMatchObject({ok:true,value:{matched:true}});
 });
});
