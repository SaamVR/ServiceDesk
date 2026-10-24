import {describe,expect,it} from "vitest";
import {planOwnerAttentionSla} from "../../src/server/ai/owner-attention-sla";
const wid="workspace-one";
const row=()=>({id:"attention-one",type:"WORKFLOW_RULE",severity:"CRITICAL",
 status:"OPEN",resourceType:"workflow_execution",resourceId:"execution-one",
 summary:"Review verified internal workflow",dueAt:"2026-10-25T01:00:00.000Z"});
const request=(items:unknown)=>({
 workspaceId:wid,actor:{workspaceId:wid,role:"OWNER"},
 now:"2026-10-25T03:00:00.000Z",
 attentionItems:items,
});
const plan=(rows:unknown)=>planOwnerAttentionSla(request(rows) as never);
describe("R50 independent critic: owner SLA inert saved source",()=>{
 it("preserves real human-reviewed overdue evidence without execution",()=>{
  expect(plan([row()])).toMatchObject({ok:true,value:{
   source:"DOUBLE_CHECKED_SAVED_ATTENTION_ROWS",overdueCount:1,
   overdue:[{attentionId:"attention-one",overdueMinutes:120}],
   ownerReviewRequired:true,workflowExecuted:false,modelInvoked:false,
   customerMessaged:false,
  }});
 });
 it("rejects array getter, proxy iterator, sparse holes, subclass and symbolic sidecars",()=>{
  const accessor=[row()];
  Object.defineProperty(accessor,"0",{get(){throw Error("private attention getter");}});
  const symbol=Object.defineProperty([row()],Symbol("secret"),{value:"token"});
  class FakeArray extends Array<unknown>{}
  const subclass=new FakeArray(row());
  const proxy=new Proxy([row()],{ownKeys(){throw Error("untrusted proxy");}});
  const sparse=new Array(1);
  for(const items of [accessor,symbol,subclass,proxy,sparse]){
   expect(()=>plan(items)).not.toThrow();
   expect(plan(items)).toMatchObject({ok:false,code:"ATTENTION_SOURCE_UNVERIFIED"});
  }
 });
 it("rejects hostile row accessors or proxy trap without executing either",()=>{
  const accessor=Object.defineProperty(row(),"dueAt",{
   enumerable:true,get(){throw Error("private customer details");},
  });
  const proxy=new Proxy(row(),{getPrototypeOf(){throw Error("adversarial row");}});
  for(const item of [accessor,proxy]){
   expect(()=>plan([item])).not.toThrow();
   expect(plan([item])).toMatchObject({ok:false,code:"ATTENTION_SOURCE_UNVERIFIED"});
  }
 });
 it("uses immutable source descriptor copies instead of untrusted live property getters",()=>{
  const proxy=new Proxy(row(),{get(target,key,receiver){
   if(key==="severity"||key==="dueAt")
    throw Error("drifted provider/attention event");
   return Reflect.get(target,key,receiver);
  }});
  expect(plan([proxy])).toMatchObject({ok:true,value:{
   overdueCount:1,overdue:[{severity:"CRITICAL",overdueMinutes:120}],
   workflowExecuted:false,customerMessaged:false,
  }});
 });
});
