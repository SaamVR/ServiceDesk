import { describe, expect, it, vi } from "vitest";
import { createPostgresConversationFacadeMethods } from "../../src/server/core/conversation-postgres";
import type { ActorContext } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const workspace="11111111-1111-4111-8111-111111111111";
const ctx={workspaceId:workspace,userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
const savedRequest={
  id:"request-1",workspaceId:workspace,customerId:"customer-1",
  serviceCode:"DEEP_CLEAN",status:"READY",bedrooms:2,bathrooms:1,
  requestedStartAt:"2026-10-21T08:00:00Z",version:3,
  createdAt:"2026-10-16T12:00:00Z",updatedAt:"2026-10-16T12:30:00+00:00",
};
const savedVisit={
  id:"visit-1",workspaceId:workspace,requestId:"request-1",
  quoteId:"quote-1",crewId:null,status:"CONFIRMED",
  startAt:"2026-10-21T08:00:00+00:00",
  serviceMinutes:90,bufferMinutes:15,version:1,
};
function query(data:Record<string,unknown>) {
  const rpc=vi.fn().mockResolvedValue({data:{ok:true,...data},error:null});
  return createPostgresConversationFacadeMethods({rpc} as unknown as SupabaseRpcClient)
    .readWorkspaceSnapshot(ctx,{});
}
describe("R10 SQL-backed Core snapshot preserves real customer service work",()=>{
  it("projects persisted requests and visits rather than invented empty queues",async()=>{
    const got=await query({requests:[savedRequest],quotes:[],visits:[savedVisit]});
    expect(got).toMatchObject({ok:true,value:{
      requests:[{id:"request-1",workspaceId:workspace,status:"READY",
        version:3,serviceCode:"DEEP_CLEAN"}],
      visits:[{id:"visit-1",workspaceId:workspace,status:"CONFIRMED",
        quoteId:"quote-1",startAt:savedVisit.startAt,serviceMinutes:90}],
      quotes:[],
    }});
  });
  it("keeps truly absent historical optional collections empty",async()=>{
    expect(await query({})).toMatchObject({ok:true,value:{
      requests:[],quotes:[],visits:[],
    }});
  });
  it("refuses cross-tenant requests and visits, never filters foreign facts to zero",async()=>{
    expect(await query({requests:[{...savedRequest,workspaceId:"foreign"}]}))
      .toMatchObject({ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH"});
    expect(await query({visits:[{...savedVisit,workspaceId:"foreign"}]}))
      .toMatchObject({ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH"});
  });
  it("refuses missing or inconsistent persisted request fields",async()=>{
    for(const patch of [
      {id:undefined},{version:undefined},{version:"3"},{version:-1},
      {createdAt:undefined},{createdAt:"yesterday"},{updatedAt:"2026-10-16T12:00:00"},
      {status:"MAGIC"},{bedrooms:"two"},{requestedStartAt:"tomorrow"},
    ]) {
      expect(await query({requests:[{...savedRequest,...patch}]}),JSON.stringify(patch))
        .toMatchObject({ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED"});
    }
  });
  it("refuses a fabricated crew visit, invalid duration, missing quote or timestamp",async()=>{
    for(const patch of [
      {id:undefined},{quoteId:undefined},{version:"1"},
      {startAt:"not-a-date"},{status:"SUCCEEDED"},
      {serviceMinutes:-1},{bufferMinutes:1.25},
      {crewId:[]},
    ]) {
      expect(await query({visits:[{...savedVisit,...patch}]}),JSON.stringify(patch))
        .toMatchObject({ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED"});
    }
  });
  it("rejects malformed arrays and future nonempty SQL quote collections instead of hiding them",async()=>{
    for(const data of [
      {requests:{}},{requests:["untrusted"]},{visits:"not an array"},
      {quotes:[{id:"quote-that-would-be-hidden"}]},
    ]) expect(await query(data)).toMatchObject({
      ok:false,code:"SNAPSHOT_RPC_ERROR_MALFORMED",
    });
  });
});
