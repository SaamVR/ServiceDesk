import {describe,expect,it,vi} from "vitest";
import {PostgresF15AtomicIngressPort,F15_ATOMIC_RPC}
 from "../../src/server/workflows/sonic-f15-postgres-port";
import {ingestF15UnansweredLeadCandidate} from "../../src/server/workflows/sonic-f15-atomic-ingress";
import type {F15AtomicEventCommand} from "../../src/server/workflows/sonic-f15-atomic-ingress";
const w="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222",r="33333333-3333-4333-8333-333333333333";
const evidence=()=>({record:{workspaceId:w,branchId:b,requestId:r,version:9,
 status:"NEW",createdAt:"2026-10-29T08:00:00.000Z",
 lastInboundAt:"2026-10-29T08:10:00.000Z",
 lastStaffResponseAt:null,responseHistoryComplete:true,
},observedAt:"2026-10-29T09:00:00.000Z",thresholdMinutes:30});
const safeReceipt=(cmd:Readonly<F15AtomicEventCommand>)=>({
 state:"INSERTED",eventKey:cmd.eventKey,workspaceId:cmd.workspaceId,
 branchId:cmd.branchId,requestId:cmd.requestId,sourceVersion:cmd.sourceVersion,
 sourceLastInboundAt:cmd.sourceLastInboundAt,transactionCommitted:true,
 sourceRecheckedUnderLock:true,uniqueEventKeyEnforced:true,
 externalSideEffects:false,savedRowsInserted:1,
});
describe("F15 PostgreSQL adapter — source only / not installed",()=>{
 it("passes only fixed owner-review event and no customer or financial fields",async()=>{
  const rpc=vi.fn(async(fn:string,args:Record<string,unknown>)=>{
   expect(fn).toBe(F15_ATOMIC_RPC);
   expect(Object.keys(args)).toEqual(["p_input"]);
   const p=args.p_input as Record<string,unknown>;
   expect(Object.keys(p).sort()).toEqual([
    "workspaceId","branchId","requestId","sourceVersion",
    "sourceLastInboundAt","eventType","eventKey","observedAt","dueAt",
    "thresholdMinutes","transactionalSourceRecheckRequired",
    "uniqueEventKeyRequired","requiresOwnerReview",
    "customerMessageAuthorized","financialMutationAuthorized",
   ].sort());
   expect(p).toMatchObject({workspaceId:w,branchId:b,requestId:r,
    sourceVersion:9,requiresOwnerReview:true,
    transactionalSourceRecheckRequired:true,uniqueEventKeyRequired:true,
    customerMessageAuthorized:false,financialMutationAuthorized:false});
   expect(JSON.stringify(args)).not.toMatch(/customerEmail|providerToken|messageBody/);
   return {data:safeReceipt({
    ...p,transactionalSourceRecheckRequired:true,uniqueEventKeyRequired:true,
    requiresOwnerReview:true,customerMessageAuthorized:false,
    financialMutationAuthorized:false,
   } as F15AtomicEventCommand),error:null};
  });
  const result=await ingestF15UnansweredLeadCandidate(evidence(),
   new PostgresF15AtomicIngressPort({rpc} as never));
  expect(result).toMatchObject({ok:true,value:{
   state:"DURABLY_RECORDED_FOR_HUMAN_REVIEW",
   ownerApprovalStillRequired:true,providerCalled:false,
   customerMessageSent:false,moneyChanged:false}});
  expect(rpc).toHaveBeenCalledTimes(1);
 });
 it("fails closed when RPC isn't installed or backend rejects access",async()=>{
  for(const response of [
   {data:null,error:{message:"missing privileged function",code:"42883"}},
   {data:null,error:{message:"permission denied",code:"42501"}},
   {data:null,error:null},
  ]){
   const rpc=vi.fn(async()=>response);
   const result=await ingestF15UnansweredLeadCandidate(evidence(),
    new PostgresF15AtomicIngressPort({rpc} as never));
   expect(result).toMatchObject({ok:false,code:"F15_TRANSACTION_UNAVAILABLE"});
   expect(JSON.stringify(result)).not.toContain("privileged function");
  }
 });
 it("refuses fabricated success if database response isn't a real strict receipt",async()=>{
  const rpc=vi.fn(async()=>({data:{ok:true,queued:true},error:null}));
  const result=await ingestF15UnansweredLeadCandidate(evidence(),
   new PostgresF15AtomicIngressPort({rpc} as never));
  expect(result).toMatchObject({ok:false,code:"F15_TRANSACTION_RECEIPT_INVALID"});
 });
 it("does not invoke privileged RPC on a not-due lead",async()=>{
  const rpc=vi.fn();
  const notDue={...evidence(),observedAt:"2026-10-29T08:20:00.000Z"};
  const result=await ingestF15UnansweredLeadCandidate(notDue,
   new PostgresF15AtomicIngressPort({rpc} as never));
  expect(result).toMatchObject({ok:false,code:"F15_NOT_DUE"});
  expect(rpc).not.toHaveBeenCalled();
 });
});
