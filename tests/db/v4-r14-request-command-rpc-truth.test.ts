import {describe,expect,it,vi} from "vitest";
import type {ActorContext} from "../../src/contracts";
import type {SupabaseRpcClient} from "../../src/server/core/payment-application-postgres";
import {createPostgresRequestQuoteCapacityFacadeMethods} from "../../src/server/core/request-quote-capacity-postgres";
const ctx={workspaceId:"11111111-1111-4111-8111-111111111111",
 userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as ActorContext;
const request={id:"33333333-3333-4333-8333-333333333333",
 workspaceId:ctx.workspaceId,customerId:null,propertyId:null,
 serviceCode:"STANDARD",status:"READY",bedrooms:2,bathrooms:1,
 requestedStartAt:"2026-10-20T11:00:00Z",version:1,
 createdAt:"2026-10-17T09:00:00Z",updatedAt:"2026-10-17T10:00:00Z"};
const meta={now:"2026-10-17T11:00:00Z",idempotencyKey:"r14-test"};
async function save(row:unknown){
  const rpc=vi.fn().mockResolvedValue({data:{ok:true,request:row},error:null});
  return createPostgresRequestQuoteCapacityFacadeMethods({rpc} as unknown as SupabaseRpcClient)
    .createRequest(ctx,{serviceCode:"STANDARD"},meta);
}
describe("R14 request RPC snapshot must derive a real tenant-scoped source",()=>{
 it("preserves saved legitimate request status, optional scope and zero rooms",async()=>{
   expect(await save(request)).toMatchObject({ok:true,value:{
     id:request.id,status:"READY",version:1,bedrooms:2,
     requestedStartAt:request.requestedStartAt}});
   expect(await save({...request,bedrooms:0,bathrooms:0,
     customerId:null,propertyId:null,requestedStartAt:null}))
     .toMatchObject({ok:true,value:{bedrooms:0,bathrooms:0}});
 });
 it("rejects missing/coerced identity, foreign workspace and unsupported status",async()=>{
   for(const patch of [
     {id:undefined},{id:""},{id:12},{workspaceId:"other-tenant"},
     {workspaceId:null},{status:undefined},{status:"PAID"},
     {customerId:[]},{propertyId:12},{serviceCode:0},{serviceCode:""},
     {version:undefined},{version:null},{version:0},{version:"1"},
     {version:1.5},{version:-1},{version:Number.MAX_SAFE_INTEGER+1},
     {createdAt:undefined},{createdAt:"yesterday"},
     {updatedAt:"2026-10-17T10:00:00"},
     {requestedStartAt:"2026-10-20T11:00:00"},
   ]) expect(await save({...request,...patch}),JSON.stringify(patch))
    .toMatchObject({ok:false,code:"REQUEST_CREATE_RPC_ERROR"});
 });
 it("rejects damaged saved bedroom or bathroom quantities instead of pretending missing",async()=>{
   for(const patch of [
     {bedrooms:"2"},{bedrooms:-1},{bedrooms:2.5},{bedrooms:Number.NaN},
     {bathrooms:"1"},{bathrooms:-2},{bathrooms:1.5},
     {bathrooms:Number.MAX_SAFE_INTEGER+1},
   ]) expect(await save({...request,...patch}),JSON.stringify(patch))
    .toMatchObject({ok:false,code:"REQUEST_CREATE_RPC_ERROR"});
 });
});
