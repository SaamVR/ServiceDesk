import {describe,expect,it} from "vitest";
import {planOwnerAttentionSla,loadOwnerAttentionSla,type OwnerAttentionSlaDeps} from "../../src/server/ai/owner-attention-sla";
const ws="workspace-1",owner={workspaceId:ws,role:"OWNER"};
const now="2026-10-19T09:00:00.000Z";
const item=(id:string,changes:Record<string,unknown>={})=>({
 id:id.length<3?"attention-"+id:id,workspaceId:ws,type:"WORKFLOW_RULE",resourceType:"workflow_execution",resourceId:"exec-1",
 status:"OPEN",severity:"CRITICAL",summary:"Review durable exception",
 dueAt:"2026-10-19T08:00:00.000Z",...changes,
});
describe("SONIC R42 L16 verified owner attention SLA",()=>{
 it("sorts actual dueAt breaches and suppresses resolved and future tasks",()=>{
  const r=planOwnerAttentionSla({workspaceId:ws,actor:owner,now,attentionItems:[
   item("a",{severity:"WARNING"}),item("b",{status:"RESOLVED"}),
   item("c",{dueAt:"2026-10-20T08:00:00.000Z"}),
   item("d",{dueAt:undefined}),item("e",{severity:"CRITICAL"})
  ] as any});
  expect(r).toMatchObject({ok:true,value:{overdueCount:2,unscheduledCount:1,
   overdue:[{attentionId:"attention-e",overdueMinutes:60},{attentionId:"attention-a",overdueMinutes:60}],
   customerMessaged:false,workflowExecuted:false}});
 });
 it("rejects counterfeit source, time, duplicate and other workspace evidence",()=>{
  for(const bad of [
   [item("a",{workspaceId:"other"})],
   [item("a"),item("a")],
   [item("a",{dueAt:"2026-02-30T00:00:00Z"})],
   [item("a",{severity:"SEVERE"})],
   [Object.assign(Object.create({hidden:"secret"}),item("a"))],
  ]){
   expect(planOwnerAttentionSla({workspaceId:ws,actor:owner,now,attentionItems:bad as any}))
    .toMatchObject({ok:false,code:"ATTENTION_SOURCE_UNVERIFIED"});
  }
  expect(planOwnerAttentionSla({workspaceId:ws,actor:owner,now:"not a clock",attentionItems:[]}))
    .toMatchObject({ok:false});
  expect(planOwnerAttentionSla({workspaceId:ws,actor:{...owner,role:"CREW"},now,attentionItems:[]}))
    .toMatchObject({ok:false,code:"ATTENTION_OWNER_REQUIRED"});
 });
 it("reads the same saved snapshot twice and refuses a changed dueAt",async()=>{
  let n=0;
  const loadSnapshot=async()=>{
   n++;return {ok:true,value:{
    workspace:{id:ws,slug:"qa-cleaning"},actor:{workspaceId:ws,role:"OWNER",userId:"owner-1"},
    loadedAt:now,attentionItems:[item("a",{dueAt:n===1?"2026-10-19T08:00:00.000Z":"2026-10-19T07:00:00.000Z"})],
   }};
  };
  const deps={loadSnapshot,now:()=>Date.parse(now)} as unknown as OwnerAttentionSlaDeps;
  expect(await loadOwnerAttentionSla("qa-cleaning",deps))
   .toMatchObject({ok:false,code:"ATTENTION_SOURCE_CHANGED"});
  expect(n).toBe(2);
 });
 it("refuses incomplete full-cap source rather than inventing an all-clear",()=>{
  const rows=Array.from({length:5000},(_,i)=>item("a"+i));
  expect(planOwnerAttentionSla({workspaceId:ws,actor:owner,now,attentionItems:rows as any}))
   .toMatchObject({ok:false,code:"ATTENTION_SOURCE_UNVERIFIED"});
 });
});
