import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import { createPostgresConversationFacadeMethods } from "../../src/server/core/conversation-postgres";

const ctx={workspaceId:"11111111-1111-4111-8111-111111111111",userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
function read(data:unknown) {
 const rpc=vi.fn().mockResolvedValue({data,error:null});
 return createPostgresConversationFacadeMethods({rpc} as unknown as SupabaseRpcClient)
   .readWorkspaceSnapshot(ctx,{});
}
describe("R6 workspace snapshot must not invent empty finance/inbox queues",()=>{
 it("allows genuinely empty loaded collections and older omitted optional collections",async()=>{
   expect(await read({ok:true,invoices:[],conversations:[],messages:[],attentionItems:[]}))
     .toMatchObject({ok:true,value:{invoices:[],conversations:[],messages:[],attentionItems:[]}});
   expect(await read({ok:true})).toMatchObject({ok:true,value:{invoices:[]}});
 });
 it("rejects a present collection whose shape or any item cannot be projected",async()=>{
   for(const change of [
     {invoices:null},{invoices:{id:"not-array"}},{invoices:[null]},
     {conversations:[42]},{messages:[false]},
     {recurrenceRules:"malformed"},{visitEvidence:[[]]},
     {visitChecklistItems:[null]},{attentionItems:[null]},
     {qualityCases:["private customer note"]},
   ]){
     const result=await read({ok:true,...change});
     expect(result,JSON.stringify(change)).toMatchObject({
       ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED",
     });
   }
 });
 it("refuses foreign tenant invoice data even inside a well-formed collection",async()=>{
   const row={id:"invoice-1",workspaceId:"not-this-workspace",
     status:"ISSUED",currency:"USD",totalMinor:500,
     allocatedMinor:0,refundedMinor:0,balanceMinor:500};
   expect(await read({ok:true,invoices:[row]})).toMatchObject({
     ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH",
   });
 });
});