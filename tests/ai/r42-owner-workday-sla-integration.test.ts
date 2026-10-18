import {describe,expect,it} from "vitest";
import {loadOwnerWorkdayPriorities,type OwnerWorkdayDependencies} from "../../src/server/ai/owner-workday-priorities";
const workspaceId="workspace-1",slug="qa-cleaning",clock="2026-10-19T05:00:00.000Z";
const attention=(dueAt:string)=>({
 id:"attention-1",type:"WORKFLOW_RULE",severity:"CRITICAL",status:"OPEN",
 resourceType:"workflow_execution",resourceId:"execution-1",
 summary:"Review persisted rule",dueAt,
});
function fixture(moved=false){
 let saved=0,auth=0;
 const loadSnapshot=async()=>{
  saved++;return {ok:true,value:{
    workspace:{id:workspaceId,slug},
    actor:{workspaceId,userId:"owner-1",role:"OWNER"},
    loadedAt:clock,
    requests:[],quotes:[],visits:[],invoices:[],
    attentionItems:[attention(moved&&saved===2?"2026-10-19T02:00:00.000Z":"2026-10-19T04:00:00.000Z")],
  }};
 };
 const resolveActor=async()=>{auth++;return {ok:true,value:{
  workspace:{id:workspaceId,slug},actor:{workspaceId,userId:"owner-1",role:"OWNER"},
 }};};
 const deps={loadSnapshot,resolveActor,now:()=>Date.parse(clock)} as unknown as OwnerWorkdayDependencies;
 return {deps,saved:()=>saved,auth:()=>auth};
}
describe("SONIC R42 owner workday now includes saved due-date escalation",()=>{
 it("includes overdue attention evidence and does not pretend an AI model or workflow acted",async()=>{
  const q=fixture();
  const result=await loadOwnerWorkdayPriorities(slug,q.deps);
  expect(result).toMatchObject({ok:true,value:{
   state:"VERIFIED_OWNER_WORKDAY_REVIEW",
   attentionSla:{state:"SAVED_ATTENTION_SLA_OWNER_REVIEW",
    overdueCount:1,overdue:[{attentionId:"attention-1",overdueMinutes:60}],
    workflowExecuted:false,customerMessaged:false},
   modelInvoked:false,providerMessageSent:false,paymentChanged:false,
  }});
  expect(q.saved()).toBe(2);expect(q.auth()).toBe(2);
 });
 it("vetoes hidden due-date drift even where aggregate owner counts remain unchanged",async()=>{
  const q=fixture(true);
  expect(await loadOwnerWorkdayPriorities(slug,q.deps))
   .toMatchObject({ok:false,code:"WORKDAY_SOURCE_CHANGED"});
 });
});
