import {describe,expect,it} from "vitest";
import {reviewF07SavedWorkflowFailures,type F07WorkflowCriticDeps}
 from "../../src/server/ai/f07-saved-workflow-critic";
const time="2026-10-25T06:00:00.000Z",now=()=>Date.parse(time);
const ws="workspace-1",branch="branch-1",slug="cleaning-test";
const execution=(overrides:Record<string,unknown>={})=>({
 id:"execution-1",branchId:branch,ruleId:"rule-1",
 ruleVersionId:"version-1",mode:"LIVE",eventType:"REQUEST_CREATED",
 matched:true,recursionDepth:0,state:"COMPLETED",
 createdAt:"2026-10-25T04:00:00.000Z",completedAt:"2026-10-25T05:00:00.000Z",...overrides,
});
const action=(overrides:Record<string,unknown>={})=>({
 id:"action-1",branchId:branch,executionId:"execution-1",
 actionIndex:0,attemptNumber:1,actionType:"SEND_EMAIL_TEMPLATE",
 state:"SUCCEEDED",createdAt:"2026-10-25T04:30:00.000Z",
 completedAt:"2026-10-25T05:00:00.000Z",...overrides,
});
function source(){
 return {loadedAt:time,workspace:{id:ws,slug},
 actor:{workspaceId:ws,userId:"owner-1",role:"OWNER"},
 branchScope:{mode:"ALL",branches:[{id:branch}]},workflowAvailable:true,
 workflowExecutions:[execution()],workflowActionExecutions:[action()]};
}
type Source=ReturnType<typeof source>;
function fixture(opts:{first?:(v:Source)=>void;second?:(v:Source)=>void;
 throwError?:boolean}={}){
 let reads=0;
 const deps={now,loadSnapshot:async()=>{
  reads++;
  if(opts.throwError)throw Error("private bearer key");
  const v=structuredClone(source());(reads===1?opts.first:opts.second)?.(v);
  return {ok:true,value:v};
 }} as unknown as F07WorkflowCriticDeps;
 return {deps,reads:()=>reads};
}
const run=(deps:F07WorkflowCriticDeps)=>
 reviewF07SavedWorkflowFailures(slug,deps);
describe("F07 owner saved workflow failures and provider-success critic",()=>{
 it("warns about successful internal workflow action without proving email delivery",async()=>{
  const f=fixture(),r=await run(f.deps);
  expect(r).toMatchObject({ok:true,value:{
   state:"F07_SAVED_WORKFLOW_CRITIC_OWNER_REVIEW_ONLY",
   source:"DOUBLE_READ_SCOPED_WORKFLOW_AND_ACTION_RECORDS",
   workspaceId:ws,inspectedExecutions:1,inspectedActions:1,
   evidenceDigest:expect.stringMatching(/^[0-9a-f]{64}$/),
   warnings:[{executionId:"execution-1",actionId:"action-1",
     kind:"PROVIDER_DELIVERY_UNVERIFIED",
     operatorNextStep:"CHECK_SAVED_OUTBOX_AND_PROVIDER_RECEIPT",
     ownerApprovalRequired:true}],
   observedHistoricalCompletenessUnverified:true,providerDeliveryProven:false,
   automaticRetry:false,customerMessageSent:false,
   providerCalled:false,moneyChanged:false,modelInvoked:false,
  }});
  expect(f.reads()).toBe(2);
 });
 it("finds misleading success and categorizes bounded saved failed attempts without exposing raw codes",async()=>{
  const patch=(v:Source)=>{
   v.workflowActionExecutions=[action({state:"FAILED",
     errorCode:"Bearer sk_live_PRIVATE_SUPER_SECRET"})];
  };
  const r=await run(fixture({first:patch,second:patch}).deps);
  expect(r).toMatchObject({ok:true,value:{warnings:expect.arrayContaining([
   {kind:"WORKFLOW_ACTION_FAILED",operatorNextStep:"REVIEW_ACTION_AND_RETRY_BUDGET"},
   {kind:"WORKFLOW_SUCCESS_CONTRADICTED",operatorNextStep:"RECONCILE_WORKFLOW_COMPLETION"},
   {kind:"PROVIDER_CODE_UNRECOGNIZED",operatorNextStep:"REVIEW_ACTION_AND_RETRY_BUDGET"},
  ])}});
  expect(JSON.stringify(r)).not.toContain("sk_live_PRIVATE");
  expect(JSON.stringify(r)).not.toContain("Bearer");
 });
 it("refuses poisoned cross-run replay and duplicate attempt keys",async()=>{
  const cases=[
   (v:Source)=>{v.workflowActionExecutions.push(action({
    id:"action-2",attemptNumber:1}));},
   (v:Source)=>{v.workflowActionExecutions.push(action({
    id:"action-2",attemptNumber:2,replayOfActionExecutionId:"missing-foreign"}));},
   (v:Source)=>{v.workflowActionExecutions.push(action({
    id:"action-2",attemptNumber:2,replayOfActionExecutionId:"action-2"}));},
   (v:Source)=>{v.workflowActionExecutions[0].branchId="foreign";},
   (v:Source)=>{v.workflowExecutions[0].eventType="UNKNOWN";},
  ];
  for(const patch of cases)
   expect(await run(fixture({first:patch}).deps))
    .toMatchObject({ok:false,code:"F07_WORKFLOW_SOURCE_UNVERIFIED"});
 });
 it("allows same-run replay only as a manual idempotency-review warning, never auto retries",async()=>{
  const patch=(v:Source)=>{v.workflowActionExecutions=[
   action({state:"FAILED",errorCode:"TIMEOUT"}),
   action({id:"action-2",attemptNumber:2,
    replayOfActionExecutionId:"action-1",state:"SUCCEEDED",
    createdAt:"2026-10-25T05:30:00.000Z",completedAt:"2026-10-25T05:40:00.000Z"}),
  ];};
  const r=await run(fixture({first:patch,second:patch}).deps);
  expect(r).toMatchObject({ok:true,value:{automaticRetry:false,
   warnings:expect.arrayContaining([
    {kind:"REPLAY_NEEDS_DEDUP_REVIEW",operatorNextStep:"INSPECT_REPLAY_IDEMPOTENCY"},
    {kind:"PROVIDER_DELIVERY_UNVERIFIED",operatorNextStep:"CHECK_SAVED_OUTBOX_AND_PROVIDER_RECEIPT"},
   ])}});
 });
 it("refuses forged success, owner changes, poison event records and exhausted pages",async()=>{
  const cases=[
   (v:Source)=>{v.actor.role="DISPATCHER";},
   (v:Source)=>{v.actor.workspaceId="foreign";},
   (v:Source)=>{v.branchScope.mode="BRANCH";},
   (v:Source)=>{v.workflowAvailable=false;},
   (v:Source)=>{v.workflowExecutions[0].branchId="foreign";},
   (v:Source)=>{v.workflowActionExecutions[0].state="DELIVERED";},
   (v:Source)=>{v.workflowExecutions=Array.from({length:1000},(_,i)=>
     execution({id:"execution-"+i}));},
   (v:Source)=>{v.workflowActionExecutions[0].createdAt="2026-02-30T00:00:00Z";},
   (v:Source)=>{Object.defineProperty(v.workflowActionExecutions[0],"secret",{value:true});},
  ];
  for(const patch of cases)expect((await run(fixture({first:patch}).deps)).ok).toBe(false);
 });
 it("detects saved provider code, attempts, state, owner or replay revision drift",async()=>{
  const cases=[
   (v:Source)=>{v.workflowActionExecutions[0].state="FAILED";},
   (v:Source)=>{Object.assign(v.workflowActionExecutions[0],{errorCode:"RATE_LIMITED"});},
   (v:Source)=>{v.workflowActionExecutions[0].attemptNumber=2;},
   (v:Source)=>{v.workflowExecutions[0].state="PARTIAL_FAILED";},
   (v:Source)=>{v.actor.userId="other-owner";},
  ];
  for(const patch of cases)
   expect(await run(fixture({second:patch}).deps))
    .toMatchObject({ok:false,code:"F07_WORKFLOW_SOURCE_CHANGED"});
 });
 it("handles provider unavailable, invalid slug, cancelled read without calling providers",async()=>{
  expect(await run(fixture({throwError:true}).deps))
   .toMatchObject({ok:false,code:"F07_WORKFLOW_SOURCE_UNAVAILABLE"});
  expect(await reviewF07SavedWorkflowFailures("BAD SLUG"))
   .toMatchObject({ok:false,code:"F07_WORKFLOW_INVALID"});
  const ac=new AbortController();ac.abort();const f=fixture();
  expect(await run({...f.deps,signal:ac.signal}))
   .toMatchObject({ok:false,code:"F07_WORKFLOW_CANCELLED"});
  expect(f.reads()).toBe(0);
 });
});
