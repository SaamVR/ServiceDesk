import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import { createPostgresConversationFacadeMethods } from "../../src/server/core/conversation-postgres";
const ctx={workspaceId:"11111111-1111-4111-8111-111111111111",userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
const invoice={id:"33333333-3333-4333-8333-333333333333",workspaceId:ctx.workspaceId,
  status:"PARTIALLY_PAID",currency:"USD",totalMinor:5000,
  allocatedMinor:3200,refundedMinor:200,balanceMinor:2000};
async function snapshot(payload:unknown){
 const rpc=vi.fn().mockResolvedValue({data:{ok:true,invoices:[payload]},error:null});
 return createPostgresConversationFacadeMethods({rpc} as unknown as SupabaseRpcClient)
   .readWorkspaceSnapshot(ctx,{});
}
describe("R6 staff finance workspace snapshot is backed by real monetary totals",()=>{
 it("retains reconciled partial-payment rows and real zero draft",async()=>{
  expect(await snapshot(invoice)).toMatchObject({ok:true,value:{invoices:[{
    id:invoice.id,totalMinor:5000,allocatedMinor:3200,refundedMinor:200,balanceMinor:2000,
  }]}});
  expect(await snapshot({...invoice,status:"DRAFT",totalMinor:0,
    allocatedMinor:0,refundedMinor:0,balanceMinor:0})).toMatchObject({ok:true});
 });
 it("rejects missing/coerced amounts, malformed currency, fake paid balance and non-reconciled totals",async()=>{
  for(const patch of [
    {totalMinor:undefined},{totalMinor:null},{totalMinor:"5000"},
    {totalMinor:Number.NaN},{totalMinor:5000.5},
    {totalMinor:Number.MAX_SAFE_INTEGER+1},{totalMinor:4999},
    {allocatedMinor:undefined},{allocatedMinor:3000.1},
    {allocatedMinor:-1},{allocatedMinor:100},
    {refundedMinor:undefined},{refundedMinor:3201},
    {balanceMinor:undefined},{balanceMinor:"2000"},
    {currency:"usd"},{currency:"USD\n"}, {status:"FAKE_PAID"},
    {status:"PAID"}, {balanceMinor:-1},
  ]){
   const result=await snapshot({...invoice,...patch});
   expect(result,JSON.stringify(patch)).toMatchObject({
     ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED",
   });
  }
 });
 it("rejects a foreign tenant even when money is consistent",async()=>{
  expect(await snapshot({...invoice,workspaceId:"unrelated"}))
    .toMatchObject({ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH"});
 });
});