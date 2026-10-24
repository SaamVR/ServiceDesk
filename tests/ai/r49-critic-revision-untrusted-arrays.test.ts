import {describe,expect,it} from "vitest";
import {reviewAutomationRevision} from "../../src/server/ai/automation-revision-review";
import type {WorkflowRuleVersionDTO} from "../../src/contracts";

const version:WorkflowRuleVersionDTO={
 id:"version-one",ruleId:"rule-one",workspaceId:"workspace-one",branchId:"branch-one",
 versionNumber:1,state:"DRAFT",eventType:"REQUEST_CREATED",
 conditions:[{field:"request.serviceCode",operator:"EQ",value:"DEEP"}],
 actions:[{type:"CREATE_ATTENTION",severity:"WARNING",summaryKey:"REVIEW_REQUEST"}],
 maxActionsPerEvent:1,createdAt:"2026-10-25T00:00:00.000Z",
};
const input=()=>({actor:{workspaceId:"workspace-one",role:"OWNER" as const},
 workspaceId:"workspace-one",branchId:"branch-one",previous:null,draft:version});
const review=(draft:WorkflowRuleVersionDTO)=>reviewAutomationRevision({...input(),draft});

describe("R49 independent critic: untrusted automation revision arrays",()=>{
 it("accepts a normal finite owner-preview revision without execution",()=>{
  expect(review(version)).toMatchObject({ok:true,value:{
   published:false,executed:false,customerMessaged:false,
  }});
 });
 it("never executes getter-backed action/condition entries",()=>{
  for(const key of ["actions","conditions"] as const){
   const poisoned=key==="actions"?[version.actions[0]]:[version.conditions[0]];
   Object.defineProperty(poisoned,"0",{enumerable:true,
    get(){throw Error("exfiltrate hidden private field");}});
   const draft={...version,[key]:poisoned};
   expect(()=>review(draft)).not.toThrow();
   expect(review(draft)).toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
  }
 });
 it("rejects class arrays, hidden sidecars, symbols, holes and proxy traps",()=>{
  class Imported extends Array<unknown>{}
  const cases:unknown[]=[
    new Imported(version.actions[0]),
    Object.defineProperty([...version.actions],"providerKey",{
      value:"secret",enumerable:false}),
    Object.defineProperty([...version.actions],Symbol("secret"),{value:"secret"}),
    new Array(1),
    new Proxy([...version.actions],{ownKeys(){throw Error("internal key");}}),
  ];
  for(const actions of cases){
   const draft={...version,actions:actions as WorkflowRuleVersionDTO["actions"]};
   expect(()=>review(draft)).not.toThrow();
   expect(review(draft)).toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
  }
 });
 it("rejects accessor-backed condition values and proxy evaluation operations",()=>{
  const values=["DEEP"];
  Object.defineProperty(values,"0",{enumerable:true,
   get(){throw Error("unsafe condition property");}});
  const draft={...version,conditions:[{field:"request.serviceCode",operator:"IN" as const,value:values}]};
  expect(()=>review(draft)).not.toThrow();
  expect(review(draft)).toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
  const proxy=new Proxy(["DEEP"],{get(target,key,receiver){
   if(key==="every")throw Error("untrusted prototype method");
   return Reflect.get(target,key,receiver);
  }});
  const second={...version,conditions:[{field:"request.serviceCode",operator:"IN" as const,value:proxy}]};
  expect(()=>review(second)).not.toThrow();
  expect(review(second)).toMatchObject({ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"});
 });
});
