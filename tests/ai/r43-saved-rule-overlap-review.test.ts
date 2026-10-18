import {describe,expect,it} from "vitest";
import {compileModelWorkflowDraft} from "../../src/server/ai/workflow-draft-proposal";
import {reviewSavedRuleOverlap} from "../../src/server/ai/saved-rule-overlap-review";
import type {WorkflowRuleVersionDTO} from "../../src/contracts";
const scope={workspaceId:"workspace-1",branchId:"branch-1",actorWorkspaceId:"workspace-1",role:"OWNER" as const};
const draft=(serviceCode?:"DEEP"|"STANDARD"|"MOVE_OUT")=>{
 const r=compileModelWorkflowDraft({eventType:"REQUEST_CREATED",severity:"WARNING",...(serviceCode?{serviceCode}:{})},scope);
 if(!r.ok)throw Error("synthetic fixture");return r.value;
};
const saved=(serviceCode?:"DEEP"|"STANDARD"|"MOVE_OUT"):WorkflowRuleVersionDTO=>({
 id:"version-1",ruleId:"rule-1",workspaceId:"workspace-1",branchId:"branch-1",
 versionNumber:2,state:"PUBLISHED",eventType:"REQUEST_CREATED",
 conditions:serviceCode?[{field:"request.serviceCode",operator:"EQ",value:serviceCode}]:[],
 actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"TEST_REVIEW"}],
 maxActionsPerEvent:1,createdAt:"2026-10-18T00:00:00Z",
});
const input=(currentPublished:WorkflowRuleVersionDTO[],proposed= [draft()])=>({
 actor:{workspaceId:"workspace-1",role:"OWNER"},workspaceId:"workspace-1",branchId:"branch-1",
 inventorySource:"SAVED_PUBLISHED_RULE_VERSIONS" as const,currentPublished,proposed,
});
describe("R43 AI L26 saved published-rule conflict check",()=>{
 it("flags definite unconditional duplicates and exact service overlap",()=>{
  expect(reviewSavedRuleOverlap(input([saved()]))).toMatchObject({ok:true,value:{
    overlapCount:1,overlaps:[{kind:"CERTAIN_SAME_EVENT_UNCONDITIONAL"}],
    completeInventoryNotProven:true,published:false,executed:false,
  }});
  expect(reviewSavedRuleOverlap(input([saved("DEEP")],[draft("DEEP")]))).toMatchObject({ok:true,value:{
    overlaps:[{kind:"CERTAIN_SAME_SERVICE_FILTER"}]
  }});
 });
 it("distinguishes provable disjoint service filters and unprovable shadowing",()=>{
  expect(reviewSavedRuleOverlap(input([saved("DEEP")],[draft("STANDARD")]))).toMatchObject({ok:true,value:{
    overlaps:[],noOverlapsInSuppliedInventory:true,completeInventoryNotProven:true
  }});
  expect(reviewSavedRuleOverlap(input([saved("DEEP")],[draft()]))).toMatchObject({ok:true,value:{
    overlaps:[{kind:"POSSIBLE_CONDITION_OVERLAP"}]
  }});
 });
 it("refuses foreign, duplicate, untrusted and hidden-rule sources",()=>{
  for(const list of [
    [{...saved(),workspaceId:"foreign"}],
    [saved(),saved()],
    [{...saved(),state:"DRAFT"}],
    [Object.defineProperty({...saved()},"hiddenSend",{value:true,enumerable:false})],
  ]){
    expect(reviewSavedRuleOverlap(input(list as WorkflowRuleVersionDTO[])))
      .toMatchObject({ok:false,code:"RULE_INVENTORY_UNVERIFIED"});
  }
  expect(reviewSavedRuleOverlap({...input([saved()]),actor:{workspaceId:"other",role:"OWNER"}}))
    .toMatchObject({ok:false,code:"RULE_INVENTORY_OWNER_REQUIRED"});
 });
 it("independent critic: reject hidden and unauthorized nested saved actions and condition accessor traps",()=>{
   const base=saved("DEEP");
   const hidden=Object.defineProperty({...base.actions[0]},"sendProviderMessage",{value:true,enumerable:false});
   const condition=Object.defineProperty({
     field:"request.serviceCode",operator:"EQ",value:"DEEP"
   },"customerEmail",{value:"private@example.test",enumerable:false});
   for(const source of [
     {...base,actions:[hidden]},
     {...base,actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"SAFE",paid:true}]},
     {...base,conditions:[condition]},
     {...base,actions:[{type:"SEND_WHATSAPP_TEMPLATE",templateKey:"unexpected"}]},
   ])expect(reviewSavedRuleOverlap(input([source as WorkflowRuleVersionDTO])))
     .toMatchObject({ok:false,code:"RULE_INVENTORY_UNVERIFIED"});
 });
 it("critic: refuse sparse arrays disguised by unrelated own keys and accessor-backed rule lists",()=>{
   const sparse:any[] = Array(1);
   (sparse as any).unapprovedRule="foreign";
   expect(reviewSavedRuleOverlap(input(sparse as WorkflowRuleVersionDTO[])))
     .toMatchObject({ok:false,code:"RULE_INVENTORY_UNVERIFIED"});
   const accessor:any[]=[];
   Object.defineProperty(accessor,"0",{enumerable:true,configurable:true,
     get(){throw Error("unsafe getter");}});
   accessor.length=1;
   expect(()=>reviewSavedRuleOverlap(input(accessor as WorkflowRuleVersionDTO[]))).not.toThrow();
   expect(reviewSavedRuleOverlap(input(accessor as WorkflowRuleVersionDTO[])))
     .toMatchObject({ok:false,code:"RULE_INVENTORY_UNVERIFIED"});
 });
 it("never calls provider, publishes or claims complete database inventory",()=>{
  const r=reviewSavedRuleOverlap(input([], [draft()]));
  expect(r).toMatchObject({ok:true,value:{inspectedPublished:0,
    noOverlapsInSuppliedInventory:true,completeInventoryNotProven:true,
    providerMessageSent:false,paymentChanged:false}});
 });
});
