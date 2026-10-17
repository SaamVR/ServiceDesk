import {describe,expect,it,vi} from "vitest";
import type {ActorContext} from "../../src/contracts";
import type {SupabaseRpcClient} from "../../src/server/core/payment-application-postgres";
import {createPostgresRequestQuoteCapacityFacadeMethods} from "../../src/server/core/request-quote-capacity-postgres";
const ctx={workspaceId:"11111111-1111-4111-8111-111111111111",
 userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
const meta={idempotencyKey:"safeguarded-send",now:"2026-10-17T10:00:00Z",expectedVersion:2};
const quote={id:"33333333-3333-4333-8333-333333333333",
 workspaceId:ctx.workspaceId,requestId:"44444444-4444-4444-8444-444444444444",
 version:2,status:"APPROVED",currency:"USD",
 subtotalMinor:5000,taxMinor:500,totalMinor:5500,
 depositMinor:1100,balanceMinor:4400,
 durationMinutes:90,bufferMinutes:15,rateVersion:"rate-2026-10",
 validUntil:"2026-10-20T12:00:00Z"};
async function send(payload:unknown){
 const rpc=vi.fn().mockResolvedValue({data:{ok:true,quote:payload},error:null});
 return createPostgresRequestQuoteCapacityFacadeMethods({rpc} as unknown as SupabaseRpcClient)
  .sendQuote(ctx,quote.id,meta);
}
describe("R14 persisted quote command RPC monetary proof",()=>{
 it("preserves coherent saved quote balances and all installed quote statuses",async()=>{
   expect(await send(quote)).toMatchObject({ok:true,value:quote});
   expect(await send({...quote,status:"PENDING_APPROVAL"}))
     .toMatchObject({ok:true,value:{status:"PENDING_APPROVAL"}});
   expect(await send({...quote,depositMinor:0,balanceMinor:5500}))
     .toMatchObject({ok:true,value:{depositMinor:0,balanceMinor:5500}});
   expect(await send({...quote,taxMinor:0,totalMinor:5000,depositMinor:5000,balanceMinor:0}))
     .toMatchObject({ok:true,value:{totalMinor:5000,balanceMinor:0}});
 });
 it("rejects forged tenant, false identity, unsupported status, currency and quote clock",async()=>{
   for(const patch of [
     {id:undefined},{id:""},{workspaceId:"different-tenant"},
     {workspaceId:undefined},{requestId:4},{requestId:null},
     {version:undefined},{version:0},{version:"2"},
     {status:"PAID"},{status:null},{currency:"usd"},
     {currency:undefined},{rateVersion:undefined},{rateVersion:""},
     {validUntil:undefined},{validUntil:"tomorrow"},
     {validUntil:"2026-10-17T10:00:00"},{validUntil:0},
   ]) expect(await send({...quote,...patch}),JSON.stringify(patch))
     .toMatchObject({ok:false,code:"QUOTE_SEND_RPC_ERROR"});
 });
 it("rejects missing, forged and unreconciled saved monetary source fields",async()=>{
   for(const patch of [
     ...["subtotalMinor","taxMinor","totalMinor","depositMinor","balanceMinor",
       "durationMinutes","bufferMinutes"].flatMap(name=>[
         {[name]:undefined},{[name]:null},{[name]:"0"},
         {[name]:-1},{[name]:Number.NaN},{[name]:1.5},
         {[name]:Number.MAX_SAFE_INTEGER+1},
       ]),
     {subtotalMinor:4500},{taxMinor:499},{totalMinor:5501},
     {depositMinor:1101},{balanceMinor:4401},
   ]) expect(await send({...quote,...patch}),JSON.stringify(patch))
     .toMatchObject({ok:false,code:"QUOTE_SEND_RPC_ERROR"});
 });
 it("rejects an untrusted quote without ever returning a successful send receipt",async()=>{
   const result=await send({...quote,status:"SENT",totalMinor:0});
   expect(result.ok).toBe(false);
 });
});
