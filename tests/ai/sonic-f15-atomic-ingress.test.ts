import {describe,expect,it,vi} from "vitest";
import {ingestF15UnansweredLeadCandidate,type F15AtomicEventCommand}
 from "../../src/server/workflows/sonic-f15-atomic-ingress";
const w="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222",r="33333333-3333-4333-8333-333333333333";
const input=()=>({record:{
 workspaceId:w,branchId:b,requestId:r,version:7,status:"OPEN",
 createdAt:"2026-10-29T08:00:00.000Z",
 lastInboundAt:"2026-10-29T08:10:00.000Z",
 lastStaffResponseAt:null,responseHistoryComplete:true,
},observedAt:"2026-10-29T09:00:00.000Z",thresholdMinutes:30});
function receipt(cmd:Readonly<F15AtomicEventCommand>,state:"INSERTED"|"ALREADY_RECORDED"){
 return {state,eventKey:cmd.eventKey,workspaceId:cmd.workspaceId,branchId:cmd.branchId,
 requestId:cmd.requestId,sourceVersion:cmd.sourceVersion,
 sourceLastInboundAt:cmd.sourceLastInboundAt,transactionCommitted:true,
 sourceRecheckedUnderLock:true,uniqueEventKeyEnforced:true,
 externalSideEffects:false,savedRowsInserted:state==="INSERTED"?1:0};
}
describe("F15 source-only atomic ingress port",()=>{
 it("blocks incomplete / missing durable adapter instead of pretending a saved event",async()=>{
  expect(await ingestF15UnansweredLeadCandidate(input())).toMatchObject({
   ok:false,code:"F15_DURABLE_PORT_REQUIRED"});
  const before={...input(),observedAt:"2026-10-29T08:39:59.000Z"};
  const commit=vi.fn();
  expect(await ingestF15UnansweredLeadCandidate(before,{claimVerifiedEvent:commit}))
   .toMatchObject({ok:false,code:"F15_NOT_DUE"});
  const incomplete={...input(),record:{...input().record,responseHistoryComplete:false}};
  expect((await ingestF15UnansweredLeadCandidate(incomplete,{claimVerifiedEvent:commit})).ok).toBe(false);
  expect(commit).not.toHaveBeenCalled();
 });
 it("requires strict frozen transactional command and honest no-side-effects receipt",async()=>{
  const commit=vi.fn(async(cmd:Readonly<F15AtomicEventCommand>)=>{
   expect(Object.isFrozen(cmd)).toBe(true);
   expect(cmd).toMatchObject({workspaceId:w,branchId:b,requestId:r,
    eventType:"UNANSWERED_LEAD_SLA_REVIEW",sourceVersion:7,
    transactionalSourceRecheckRequired:true,uniqueEventKeyRequired:true,
    requiresOwnerReview:true,customerMessageAuthorized:false,
    financialMutationAuthorized:false});
   return receipt(cmd,"INSERTED");
  });
  const result=await ingestF15UnansweredLeadCandidate(input(),{claimVerifiedEvent:commit});
  expect(result).toMatchObject({ok:true,value:{
   state:"DURABLY_RECORDED_FOR_HUMAN_REVIEW",duplicate:false,
   durableEventRecorded:true,ownerApprovalStillRequired:true,
   workflowExecuted:false,providerCalled:false,customerMessageSent:false,moneyChanged:false}});
  expect(commit).toHaveBeenCalledTimes(1);
 });
 it("simulates twelve racing retries with a mock atomic unique ledger",async()=>{
  // Fake is for contract tests, not proof of cross-process PostgreSQL durability.
  const known=new Set<string>();
  const port={claimVerifiedEvent:async(cmd:Readonly<F15AtomicEventCommand>)=>{
   await Promise.resolve();
   const state=known.has(cmd.eventKey)?"ALREADY_RECORDED":"INSERTED";
   known.add(cmd.eventKey);
   return receipt(cmd,state);
  }};
  const results=await Promise.all(Array.from({length:12},()=>ingestF15UnansweredLeadCandidate(input(),port)));
  expect(results.every(x=>x.ok)).toBe(true);
  expect(results.filter(x=>x.ok&&!x.value.duplicate)).toHaveLength(1);
  expect(results.filter(x=>x.ok&&x.value.duplicate)).toHaveLength(11);
  expect(known.size).toBe(1);
 });
 it("fails closed on forged, stale, cross-tenant, duplicate or side-effect receipts",async()=>{
  const cases=[
   (x:ReturnType<typeof receipt>)=>({...x,transactionCommitted:false}),
   (x:ReturnType<typeof receipt>)=>({...x,sourceRecheckedUnderLock:false}),
   (x:ReturnType<typeof receipt>)=>({...x,uniqueEventKeyEnforced:false}),
   (x:ReturnType<typeof receipt>)=>({...x,externalSideEffects:true}),
   (x:ReturnType<typeof receipt>)=>({...x,sourceVersion:6}),
   (x:ReturnType<typeof receipt>)=>({...x,sourceLastInboundAt:"2026-10-29T08:09:00.000Z"}),
   (x:ReturnType<typeof receipt>)=>({...x,workspaceId:b}),
   (x:ReturnType<typeof receipt>)=>({...x,branchId:w}),
   (x:ReturnType<typeof receipt>)=>({...x,requestId:b}),
   (x:ReturnType<typeof receipt>)=>({...x,eventKey:"unrelated"}),
   (x:ReturnType<typeof receipt>)=>({...x,savedRowsInserted:2}),
   (x:ReturnType<typeof receipt>)=>({...x,customerMessageSent:true}),
   (x:ReturnType<typeof receipt>)=>({...x,state:"ALREADY_RECORDED",savedRowsInserted:1}),
  ];
  for(const change of cases){
   const result=await ingestF15UnansweredLeadCandidate(input(),{
    claimVerifiedEvent:async cmd=>change(receipt(cmd,"INSERTED")),
   });
   expect(result).toMatchObject({ok:false,code:"F15_TRANSACTION_RECEIPT_INVALID"});
  }
 });
 it("does not disclose provider exceptions or report successful ingestion",async()=>{
  const result=await ingestF15UnansweredLeadCandidate(input(),{
    claimVerifiedEvent:async()=>{throw Error("secret provider credentials");},
  });
  expect(result).toMatchObject({ok:false,code:"F15_TRANSACTION_UNAVAILABLE"});
  expect(JSON.stringify(result)).not.toContain("secret");
 });
});
