import {describe,expect,it,vi} from "vitest";
import {processOwnerInboxRequestRules} from "../../src/server/ai/owner-inbox-request-rules";
const w="11111111-1111-4111-8111-111111111111";
const b="22222222-2222-4222-8222-222222222222";
const request="33333333-3333-4333-8333-333333333333";
const conversation="44444444-4444-4444-8444-444444444444";
const customer="55555555-5555-4555-8555-555555555555";
const user="66666666-6666-4666-8666-666666666666";
const foreign="77777777-7777-4777-8777-777777777777";
type Options={status?:string;branch?:string;customer?:string;version?:number;
 actorRole?:string;scope?:string;actorId?:string;conversationRequest?:string};
function fixture(options:Options={}){
 const conv={id:conversation,workspace_id:w,
  branch_id:options.branch??b,request_id:options.conversationRequest??request,
  customer_id:customer,version:5};
 const req={id:request,workspace_id:w,branch_id:options.branch??b,
  customer_id:options.customer??customer,status:options.status??"NEW",
  version:options.version??4};
 const calls:string[]=[];
 const client={from:(table:string)=>({
  select:(_fields:string)=>{
   void _fields;
   const matches:Record<string,unknown>={};
   const q={
    eq(field:string,value:unknown){matches[field]=value;return q;},
    async maybeSingle(){
     calls.push(table);
     const row=table==="conversations"?conv:table==="requests"?req:null;
     const valid=row&&Object.entries(matches).every(([key,value])=>
      (row as Record<string,unknown>)[key]===value);
     return {data:valid?row:null,error:null};
    },
   };
   return q;
  },
 })};
 const resolved={ok:true,value:{
  workspace:{id:w,slug:"demo-workspace"},
  actor:{userId:options.actorId??user,workspaceId:w,role:options.actorRole??"OWNER"},
  branchScope:{mode:options.scope??"ALL",branches:[{id:b}]},
  service:client,rpc:client,
 }};
 return {calls,resolved};
}
const receipt=(patch:Record<string,unknown>={})=>({
 ok:true,value:{
  state:"PERSISTED_INTERNAL_WORKFLOW_PROCESSING",requestId:request,
  matchedExecutions:1,completedAttentionActions:1,externalApprovalRequired:0,
  providerMessagesSent:0,replayedSourceEvent:false,
  newlyRecordedRuleExecutions:1,reusedRuleExecutions:0,...patch,
 }});
function deps(f:ReturnType<typeof fixture>,run=vi.fn(async()=>receipt())){
 return {mode:()=>"SERVICE_ROLE" as const,
  resolveActor:(async()=>f.resolved) as never,executeRequest:run as never};
}
describe("F19 owner Inbox → existing durable REQUEST_CREATED workflow action",()=>{
 it("resolves exact saved Inbox conversation, reauthorizes twice, invokes original persisted executor once",async()=>{
  const f=fixture(),run=vi.fn(async()=>receipt());
  const res=await processOwnerInboxRequestRules("demo-workspace",conversation,deps(f,run));
  expect(res).toMatchObject({ok:true,value:{
   state:"PERSISTED_INTERNAL_REQUEST_RULES",matchedRules:1,
   completedAttentionActions:1,newlyRecordedExecutions:1,reusedExecutions:0,
   persistedInternalAttentionVerified:true,ownerTriggered:true,
   customerMessageSent:false,externalMessagesSent:0,moneyChanged:false,
   automaticSlaEventCreated:false,
  }});
  expect(run).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith("demo-workspace",request);
  expect(f.calls).toEqual(["conversations","requests","conversations","requests"]);
 });
 it("reports zero saved attention honestly when rules were not configured or matched",async()=>{
  const f=fixture(),run=vi.fn(async()=>receipt({
   matchedExecutions:0,completedAttentionActions:0,newlyRecordedRuleExecutions:0,
  }));
  const res=await processOwnerInboxRequestRules("demo-workspace",conversation,deps(f,run));
  expect(res).toMatchObject({ok:true,value:{
   state:"NO_INTERNAL_ATTENTION_CREATED",persistedInternalAttentionVerified:false,
   completedAttentionActions:0,
  }});
 });
 it("rejects malformed input before authorization, and disabled trusted backend before reads",async()=>{
  const f=fixture(),run=vi.fn(async()=>receipt());
  const setup=deps(f,run);
  for(const [slug,id] of [
   ["bad/slug",conversation],["demo-workspace","test@example.invalid"],
   ["x",conversation],["demo-workspace",foreign],
  ]){
   const res=await processOwnerInboxRequestRules(slug,id,setup);
   if(id===foreign)expect(res.ok).toBe(false);
   else expect(res).toMatchObject({ok:false,code:"F19_INPUT_INVALID"});
  }
  expect(run).not.toHaveBeenCalled();
  const disabled=await processOwnerInboxRequestRules("demo-workspace",conversation,{
   ...setup,mode:()=>"RLS_AUTH" as never,
  });
  expect(disabled).toMatchObject({ok:false,code:"F19_BACKEND_DISABLED"});
 });
 it("denies dispatcher, branch-limited session and invalid owner memberships",async()=>{
  const run=vi.fn(async()=>receipt());
  for(const options of [
   {actorRole:"DISPATCHER"},{scope:"BRANCH"},{actorId:""},
  ]){
   const f=fixture(options);
   const res=await processOwnerInboxRequestRules("demo-workspace",conversation,deps(f,run));
   expect(res).toMatchObject({ok:false,code:"F19_OWNER_REQUIRED"});
  }
  expect(run).not.toHaveBeenCalled();
 });
 it("denies foreign branch, customer mismatch and request-not-linked tampering",async()=>{
  const run=vi.fn(async()=>receipt());
  for(const options of [
   {branch:foreign},{customer:foreign},{conversationRequest:foreign},
   {status:"CLOSED"},{version:0},
  ]){
   const f=fixture(options);
   const res=await processOwnerInboxRequestRules("demo-workspace",conversation,deps(f,run));
   expect(res).toMatchObject({ok:false,code:"F19_SAVED_REQUEST_UNAVAILABLE"});
  }
  expect(run).not.toHaveBeenCalled();
 });
 it("blocks saved request changes between the two reads, without executing a workflow",async()=>{
  const f=fixture(),run=vi.fn(async()=>receipt());
  let count=0;
  const res=await processOwnerInboxRequestRules("demo-workspace",conversation,{
   ...deps(f,run),
   resolveActor:(async()=>{count++;
    return count===1?f.resolved:fixture({version:5}).resolved;
   }) as never,
  });
  expect(res).toMatchObject({ok:false,code:"F19_SOURCE_CHANGED"});
  expect(run).not.toHaveBeenCalled();
 });
 it("blocks actor identity changes between reads",async()=>{
  const f=fixture(),run=vi.fn(async()=>receipt());
  let count=0;
  const res=await processOwnerInboxRequestRules("demo-workspace",conversation,{
   ...deps(f,run),
   resolveActor:(async()=>{count++;
    return count===1?f.resolved:fixture({actorId:foreign}).resolved;
   }) as never,
  });
  expect(res).toMatchObject({ok:false,code:"F19_SOURCE_CHANGED"});
  expect(run).not.toHaveBeenCalled();
 });
 it("refuses forged execution counts, mismatched request and false external delivery",async()=>{
  for(const patch of [
   {requestId:foreign},{providerMessagesSent:1},
   {matchedExecutions:-1},{matchedExecutions:3,newlyRecordedRuleExecutions:1},
   {reusedRuleExecutions:65},{replayedSourceEvent:"yes"},
   {state:"PREVIEWED"},{completedAttentionActions:Number.POSITIVE_INFINITY},
   {completedAttentionActions:8},{externalApprovalRequired:8},
  ]){
   const f=fixture(),run=vi.fn(async()=>receipt(patch));
   const res=await processOwnerInboxRequestRules("demo-workspace",conversation,deps(f,run));
   expect(res).toMatchObject({ok:false,code:"F19_RULE_EXECUTION_UNAVAILABLE"});
  }
 });
 it("never exposes failed executor's raw error or secrets to browser",async()=>{
  const f=fixture();
  const res=await processOwnerInboxRequestRules("demo-workspace",conversation,
   deps(f,vi.fn(async()=>{throw Error("secret token");})));
  expect(res).toMatchObject({ok:false,code:"F19_RULE_EXECUTION_UNAVAILABLE"});
  expect(JSON.stringify(res)).not.toContain("secret");
 });
});
