import { describe, expect, it, vi } from "vitest";
import type { VerifiedPaymentEvent } from "../../src/server/core/facade";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import { createPostgresPaymentApplicationFacadeMethods } from "../../src/server/core/payment-application-postgres";
const event={provider:"stripe",providerAccountId:"acct_test",providerEventId:"evt_demo",
  providerTransactionId:"pi_demo",purpose:"DEPOSIT",workspaceId:"11111111-1111-4111-8111-111111111111",
  amountMinor:10000,currency:"USD",occurredAt:"2026-10-16T08:00:00Z",
  quoteId:"22222222-2222-4222-8222-222222222222",holdId:"33333333-3333-4333-8333-333333333333"} as VerifiedPaymentEvent;
const visit={id:"44444444-4444-4444-8444-444444444444",workspaceId:event.workspaceId,
  requestId:"55555555-5555-4555-8555-555555555555",
  quoteId:event.quoteId,status:"CONFIRMED",startAt:"2026-10-17T08:00:00Z",
  serviceMinutes:60,bufferMinutes:15,version:1};
const invoice={id:"66666666-6666-4666-8666-666666666666",workspaceId:event.workspaceId,
  visitId:visit.id,status:"PAID",currency:"USD",totalMinor:10000,
  allocatedMinor:10000,refundedMinor:0,balanceMinor:0};
function build(data:unknown,error:unknown=null) {
 const rpc=vi.fn().mockResolvedValue({data,error});
 return createPostgresPaymentApplicationFacadeMethods({rpc} as unknown as SupabaseRpcClient);
}
describe("R6 verified payment RPC requires financial and tenant truth",()=>{
 it("accepts exact reconciled payload and permits review with absent invoice",async()=>{
  expect(await build({ok:true,state:"APPLIED",invoice,visit}).applyVerifiedPayment(event))
    .toMatchObject({ok:true,value:{state:"APPLIED",invoice:{id:invoice.id},visit:{id:visit.id}}});
  expect(await build({ok:true,state:"PAYMENT_REVIEW",attentionItemId:"attention-1"})
    .applyVerifiedPayment(event)).toMatchObject({ok:true,value:{state:"PAYMENT_REVIEW"}});
 });
 it("blocks foreign projections, bad money, impossible visit schedule and unbalanced ledgers",async()=>{
  const scenarios=[
    {invoice:{...invoice,workspaceId:"foreign"},visit},
    {invoice,visit:{...visit,workspaceId:"foreign"}},
    {invoice:{...invoice,visitId:"foreign"},visit},
    {invoice:{...invoice,currency:"EUR"},visit},
    {invoice:{...invoice,currency:"usd"},visit},
    {invoice:{...invoice,totalMinor:10001},visit},
    {invoice:{...invoice,balanceMinor:1},visit},
    {invoice:{...invoice,allocatedMinor:10000.5},visit},
    {invoice:{...invoice,refundedMinor:10001},visit},
    {invoice,visit:{...visit,serviceMinutes:1.25}},
    {invoice,visit:{...visit,startAt:"not-a-time"}},
    {invoice,visit:{...visit,version:-1}},
  ];
  for(const attempt of scenarios) {
    const result=await build({ok:true,state:"APPLIED",...attempt}).applyVerifiedPayment(event);
    expect(result.ok,JSON.stringify(attempt)).toBe(false);
  }
 });
 it("never binds a provider callback to a different invoice or quote within the same tenant",async()=>{
   const payload={ok:true,state:"APPLIED",invoice,visit};
   const correct={...event,invoiceId:invoice.id};
   expect(await build(payload).applyVerifiedPayment(correct))
     .toMatchObject({ok:true,value:{state:"APPLIED",invoice:{id:invoice.id}}});
   for(const mismatched of [
     {...event,invoiceId:"77777777-7777-4777-8777-777777777777"},
     {...event,quoteId:"88888888-8888-4888-8888-888888888888"},
     {...event,invoiceId:invoice.id,quoteId:"99999999-9999-4999-8999-999999999999"},
   ]) {
     expect(await build(payload).applyVerifiedPayment(mismatched),
       JSON.stringify(mismatched)).toMatchObject({ok:false,code:"PAYMENT_RPC_SCOPE_MISMATCH"});
   }
 });
 it("does not leak raw SQL/provider secrets on thrown, rejected or malformed RPC",async()=>{
  const token="Bearer private-key user@example.com";
  for(const response of [
    {data:null,error:{code:"unexpected!bad",message:token}},
    {data:{ok:false,code:"secret:token"},error:null},
    {data:{ok:true,state:"__" + token},error:null},
  ]) {
    const result=await build(response.data,response.error).applyVerifiedPayment(event);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain("secret:token");
  }
  const rpc=vi.fn().mockRejectedValue(new Error(token));
  const facade=createPostgresPaymentApplicationFacadeMethods({rpc} as unknown as SupabaseRpcClient);
  expect(await facade.applyVerifiedPayment(event))
    .toMatchObject({ok:false,code:"PAYMENT_RPC_UNAVAILABLE"});
 });
});
