import {describe,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
import {acknowledgeF15OneSavedInternalAttention} from "../../src/server/workflows/sonic-f15-owner-acknowledge";
const workspaceId="11111111-1111-4111-8111-111111111111";
const branchId="22222222-2222-4222-8222-222222222222";
const requestId="33333333-3333-4333-8333-333333333333";
const actorId="44444444-4444-4444-8444-444444444444";
const reviewId="55555555-5555-4555-8555-555555555555";
const attentionId="66666666-6666-4666-8666-666666666666";
const owner=()=>({workspaceId,actorId,branches:[branchId],service:{} as never});
const candidate=()=>({workspaceId,branchId,requestId,reviewId,attentionId});
const deps=()=>({
 enabled:()=>true,mode:()=> "SERVICE_ROLE" as const,
 resolve:vi.fn(async()=>owner()),
 find:vi.fn(async()=>({state:"ONE" as const,candidate:candidate()})),
 commit:vi.fn(async()=>true),readback:vi.fn(async()=>true),
});
describe("F15 explicit owner-only saved attention acknowledgement",()=>{
 it("is disabled before any owner lookup or write",async()=>{
  const d=deps();
  expect(await acknowledgeF15OneSavedInternalAttention("workspace",branchId,requestId,{
   ...d,enabled:()=>false,
  })).toEqual({state:"NOT_ACTIVATED",providerSent:false,workflowExecuted:false});
  expect(d.resolve).not.toHaveBeenCalled();
  expect(d.commit).not.toHaveBeenCalled();
 });
 it("acknowledges only one exact saved open row, two owner reauthorizations and readback",async()=>{
  const d=deps();
  expect(await acknowledgeF15OneSavedInternalAttention("workspace",branchId,requestId,d))
   .toEqual({state:"ACKNOWLEDGED_VERIFIED",providerSent:false,workflowExecuted:false});
  expect(d.resolve).toHaveBeenCalledTimes(2);
  expect(d.find).toHaveBeenCalledWith(expect.anything(),workspaceId,branchId,requestId);
  expect(d.commit).toHaveBeenCalledWith(expect.anything(),candidate());
  expect(d.readback).toHaveBeenCalledWith(expect.anything(),candidate());
 });
 it("refuses ambiguous, stale, absent and foreign scope without performing a write",async()=>{
  for(const state of ["AMBIGUOUS","NONE"] as const){
   const d=deps();
   const result=await acknowledgeF15OneSavedInternalAttention("workspace",branchId,requestId,{
    ...d,find:async()=>({state}),
   });
   expect(result.state).toBe(state==="AMBIGUOUS"?"AMBIGUOUS_OPEN_REVIEWS":"NO_OPEN_REVIEW");
   expect(d.commit).not.toHaveBeenCalled();
  }
  const d=deps();
  const result=await acknowledgeF15OneSavedInternalAttention("workspace",
   "77777777-7777-4777-8777-777777777777",requestId,d);
  expect(result.state).toBe("UNAVAILABLE");
  expect(d.commit).not.toHaveBeenCalled();
  const forged=deps();
  expect((await acknowledgeF15OneSavedInternalAttention("workspace",branchId,requestId,{
   ...forged,find:async()=>({state:"ONE",candidate:{
     ...candidate(),workspaceId:branchId,
   }}),
  })).state).toBe("UNAVAILABLE");
  expect(forged.commit).not.toHaveBeenCalled();
 });
 it("cannot write after role revocation or changed actor, and never claims a forged update",async()=>{
  let count=0;
  const revoked=deps();
  expect((await acknowledgeF15OneSavedInternalAttention("workspace",branchId,requestId,{
   ...revoked,resolve:async()=>++count===1?owner():null,
  })).state).toBe("UNAVAILABLE");
  expect(revoked.commit).not.toHaveBeenCalled();
  const changed=deps();
  let reads=0;
  expect((await acknowledgeF15OneSavedInternalAttention("workspace",branchId,requestId,{
   ...changed,resolve:async()=>++reads===1?owner():{...owner(),
     actorId:"88888888-8888-4888-8888-888888888888"},
  })).state).toBe("UNAVAILABLE");
  expect(changed.commit).not.toHaveBeenCalled();
  const stale=deps();
  expect((await acknowledgeF15OneSavedInternalAttention("workspace",branchId,requestId,{
   ...stale,commit:async()=>false,
  })).state).toBe("UNAVAILABLE");
  const unverified=deps();
  expect((await acknowledgeF15OneSavedInternalAttention("workspace",branchId,requestId,{
   ...unverified,readback:async()=>false,
  })).state).toBe("UNAVAILABLE");
 });
 it("source uses OPEN CAS and verifies persisted ACK; client exposes no raw IDs or send",()=>{
  const backend=readFileSync("src/server/workflows/sonic-f15-owner-acknowledge.ts","utf8");
  const action=readFileSync("src/features/operations/f15-owner-acknowledge-action.ts","utf8");
  const ui=readFileSync("src/features/operations/OwnerLinkedAttentionReview.tsx","utf8");
  expect(backend).toContain('.eq("status","OPEN").select(');
  expect(backend).toContain('.eq("resource_id",c.reviewId)');
  expect(backend).toContain('status:"ACKNOWLEDGED"');
  expect(backend).toContain('result.data.status==="ACKNOWLEDGED"');
  expect(backend).toContain('SERVICEDESK_F15_OWNER_MANUAL_ESCALATION_ENABLED');
  expect(action).toContain('"use server"');
  expect(ui).toContain('proof.open===1');
  expect(ui).toContain('requestF15OwnerAcknowledge(slug,branchId,requestId)');
  expect(ui).toContain('requestF15LinkedAttentionProof(slug,branchId,requestId)');
  for(const bad of ["sendEmail(", "sendWhatsApp(", "processPayment(", "createPayment(",
    "runWorkflow(", "customerEmail", "recipientAddress"]){
     expect(backend+action+ui).not.toContain(bad);
  }
 });
});
