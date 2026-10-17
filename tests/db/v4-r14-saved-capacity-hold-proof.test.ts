import {describe,expect,it,vi} from "vitest";
import type {ActorContext} from "../../src/contracts";
import type {SupabaseRpcClient} from "../../src/server/core/payment-application-postgres";
import {createPostgresRequestQuoteCapacityFacadeMethods} from "../../src/server/core/request-quote-capacity-postgres";
const ctx={workspaceId:"11111111-1111-4111-8111-111111111111",
  userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
const meta={idempotencyKey:"hold-verified",expectedVersion:1,
  now:"2026-10-17T10:00:00Z"};
const quote={id:"33333333-3333-4333-8333-333333333333",
 workspaceId:ctx.workspaceId,requestId:"44444444-4444-4444-8444-444444444444",
 version:1,status:"APPROVED",currency:"USD",
 subtotalMinor:5000,taxMinor:500,totalMinor:5500,depositMinor:1100,balanceMinor:4400,
 durationMinutes:90,bufferMinutes:15,rateVersion:"rc-1",
 validUntil:"2026-10-20T12:00:00Z"};
const slot={id:"55555555-5555-4555-8555-555555555555",
 workspaceId:ctx.workspaceId,crewId:"66666666-6666-4666-8666-666666666666",
 startAt:"2026-10-18T09:00:00Z",endAt:"2026-10-18T11:00:00Z"};
async function held(payload:Record<string,unknown>){
 const rpc=vi.fn().mockResolvedValue({data:{ok:true,hold:payload},error:null});
 return createPostgresRequestQuoteCapacityFacadeMethods({rpc} as unknown as SupabaseRpcClient)
   .holdSlot(ctx,slot.id,quote.id,meta);
}
async function slots(payload:unknown[],savedQuote:Record<string,unknown>=quote){
 const rpc=vi.fn().mockImplementation(async(name:string)=>{
  if(name==="servicedesk_get_latest_quote_for_request")
   return {data:{ok:true,quote:savedQuote},error:null};
  if(name==="servicedesk_find_capacity_slots")
   return {data:{ok:true,slots:payload},error:null};
  throw new Error("unexpected RPC");
 });
 return createPostgresRequestQuoteCapacityFacadeMethods({rpc} as unknown as SupabaseRpcClient)
  .findSlots(ctx,{requestId:quote.requestId,from:"2026-10-18T00:00:00Z",
    to:"2026-10-19T00:00:00Z"});
}
describe("R14 verified saved capacity-slot and hold receipts",()=>{
 it("accepts genuine owner-scoped and future-dated hold receipt",async()=>{
   expect(await held({id:"hold-real",expiresAt:"2026-10-17T10:10:00Z"}))
     .toMatchObject({ok:true,value:{holdId:"hold-real",
       expiresAt:"2026-10-17T10:10:00Z"}});
 });
 it("refuses a fabricated or expired hold as a successful reservation",async()=>{
   for(const patch of [
     {id:undefined},{id:null},{id:0},{id:""},
     {expiresAt:undefined},{expiresAt:null},{expiresAt:0},
     {expiresAt:"tomorrow"},{expiresAt:"2026-10-17T10:10:00"},
     {expiresAt:meta.now},{expiresAt:"2026-10-17T09:59:59Z"},
   ]) expect(await held({id:"hold-real",expiresAt:"2026-10-17T10:10:00Z",...patch}),
     JSON.stringify(patch)).toMatchObject({ok:false,code:"HOLD_SLOT_RPC_ERROR"});
 });
 it("keeps legitimate saved slots and their persisted interval",async()=>{
   expect(await slots([slot])).toMatchObject([{
     id:slot.id,workspaceId:ctx.workspaceId,crewId:slot.crewId,
     startAt:slot.startAt,endAt:slot.endAt,serviceMinutes:90,bufferMinutes:15}]);
 });
 it("fails the slot read closed on false identity, corrupt dates or foreign tenant",async()=>{
   for(const patch of [
     {id:undefined},{id:""},{crewId:undefined},{crewId:4},
     {workspaceId:"unrelated"},{workspaceId:undefined},
     {startAt:undefined},{startAt:"tomorrow"},{startAt:"2026-10-18T09:00:00"},
     {endAt:undefined},{endAt:"2026-10-18T08:00:00Z"},
     {endAt:slot.startAt},{endAt:"unverified"},
   ]) expect(await slots([{...slot,...patch}]),JSON.stringify(patch)).toEqual([]);
   // A valid response for another request cannot authorize this request's
   // displayed slots, even when the same tenant owns both.
   expect(await slots([slot],{...quote,requestId:"other-request"})).toEqual([]);
 });
});
