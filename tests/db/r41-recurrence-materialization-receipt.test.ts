import {describe,expect,it,vi} from "vitest";
import {materializeDueRecurrences} from "../../src/server/core/recurrence-postgres";
import type {SupabaseRpcClient} from "../../src/server/core/payment-application-postgres";

const receipt={
 ruleId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 occurrenceId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 requestId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
 sequence:1,occurrenceOn:"2026-10-18",
 requestedStartAt:"2026-10-18T09:30:00.000Z",
};
function rpcFixture(data:Record<string,unknown>){
 const rpc=vi.fn(async()=>({data,error:null}));
 return {client:{rpc} as unknown as SupabaseRpcClient,rpc};
}
describe("R41 CORE-D persisted recurring-service materialization receipt correctness",()=>{
 it("acknowledges only complete correctly parsed materialization results",async()=>{
   const fixture=rpcFixture({ok:true,materializedCount:1,materialized:[receipt]});
   const result=await materializeDueRecurrences(fixture.client,{limit:25});
   expect(result).toMatchObject({ok:true,value:{
     materializedCount:1,materialized:[receipt],
   }});
   expect(fixture.rpc).toHaveBeenCalledWith("servicedesk_materialize_due_recurrences",{p_input:{limit:25}});
 });
 it("requires count and rows to agree rather than dropping invalid results",async()=>{
   for(const payload of [
      {materializedCount:2,materialized:[receipt]},
      {materializedCount:1,materialized:[]},
      {materializedCount:1},
      {materializedCount:-1,materialized:[]},
      {materializedCount:1.5,materialized:[receipt]},
      {materializedCount:101,materialized:[]},
      {materializedCount:1,materialized:[null]},
      {materializedCount:1,materialized:[{...receipt,sequence:0}]},
      {materializedCount:1,materialized:[{...receipt,occurrenceOn:"2026-02-30"}]},
      {materializedCount:1,materialized:[{...receipt,requestedStartAt:"2026-10-18T25:00:00Z"}]},
    ]){
      const {client}=rpcFixture({ok:true,...payload});
      expect(await materializeDueRecurrences(client,{}))
        .toMatchObject({ok:false,code:"RECURRENCE_MATERIALIZE_RECEIPT_INVALID"});
   }
 });
 it("rejects duplicate durable IDs instead of reporting two new bookings",async()=>{
   const {client}=rpcFixture({ok:true,materializedCount:2,materialized:[
    receipt,{...receipt,ruleId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",sequence:2},
   ]});
   expect(await materializeDueRecurrences(client,{}))
     .toMatchObject({ok:false,code:"RECURRENCE_MATERIALIZE_RECEIPT_INVALID"});
 });
 it("rejects forged hidden/unexpected receipt fields with no false success",async()=>{
   const hidden=Object.defineProperty({...receipt},"chargedCustomer",{value:true,enumerable:false});
   const {client}=rpcFixture({ok:true,materializedCount:1,materialized:[hidden]});
   expect(await materializeDueRecurrences(client,{}))
     .toMatchObject({ok:false,code:"RECURRENCE_MATERIALIZE_RECEIPT_INVALID"});
   expect(await materializeDueRecurrences(rpcFixture({ok:true,materializedCount:0,materialized:[]}).client,{}))
     .toMatchObject({ok:true,value:{materializedCount:0,materialized:[]}});
 });
});
