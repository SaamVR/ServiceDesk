import {describe,expect,it,vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {SupabaseRpcClient} from "../../src/server/core/payment-application-postgres";
import {runInternalQuoteSourceRecoveryBatch} from "../../src/server/workflows/customer-quote-source-recovery";

const workspace="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const quote="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const request="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const customer="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const workerId="worker_r50_guard";
const claimRow=()=>({
 id,workspace_id:workspace,quote_id:quote,event_type:"QUOTE_ACCEPTED",
 state:"PROCESSING",locked_by:workerId,
 locked_until:new Date(Date.now()+180000).toISOString(),attempts:1,
});
function harness(claim:unknown,completion:unknown={ok:true,state:"SUCCEEDED"}){
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const rpc={rpc:vi.fn(async(name:string,args:Record<string,unknown>)=>{
  calls.push({name,args});
  return name==="servicedesk_claim_quote_source_events"
   ? {data:claim,error:null}:{data:completion,error:null};
 })} as unknown as SupabaseRpcClient;
 const rows:Record<string,Record<string,unknown>>={
  quotes:{id:quote,workspace_id:workspace,request_id:request,status:"ACCEPTED",
   accepted_at:"2026-10-25T00:00:00.000Z",superseded_by:null},
  requests:{id:request,workspace_id:workspace,customer_id:customer},
  workflow_source_events:claimRow(),
 };
 const from=vi.fn((table:string)=>{
  const where:Record<string,unknown>={};
  const chain={
   select:()=>chain,
   eq:(name:string,value:unknown)=>{where[name]=value;return chain;},
   maybeSingle:async()=>({
     data:table in rows && Object.entries(where).every(([k,v])=>rows[table][k]===v)
      ? rows[table]:null,error:null,
   }),
  };
  return chain;
 });
 const service={from} as unknown as SupabaseClient;
 const bridge=vi.fn(async()=>({
  ok:true as const,value:{
    state:"PERSISTED_INTERNAL_QUOTE_ACCEPTED_AUTOMATION",
    newlyRecordedRuleExecutions:1,reusedRuleExecutions:0,
    completedAttentionActions:1,approvalRequired:0,providerMessagesSent:0 as const,
  },
 }));
 const run=()=>runInternalQuoteSourceRecoveryBatch({
  service,rpc,workerId,maxBatch:5,
 },{enabled:()=>true,bridge:bridge as never});
 return {run,from,bridge,calls,rpc};
}
describe("R50 independent critic: trusted quote source claims never use untrusted RPC objects",()=>{
 it("handles an ordinary verified lease and saved internal receipt",async()=>{
  const t=harness([claimRow()]);
  expect(await t.run()).toMatchObject({state:"BATCH_PROCESSED",
   claimed:1,completed:1,completionNotVerified:0,providerMessagesSent:0});
  expect(t.bridge).toHaveBeenCalledOnce();
  expect(t.calls.map(x=>x.name)).toEqual([
   "servicedesk_claim_quote_source_events",
   "servicedesk_complete_quote_source_event",
  ]);
 });
 it("blocks accessor, sparse, subclass, extra-key and symbolic claim arrays before any work",async()=>{
  const getter=[claimRow()];
  Object.defineProperty(getter,"0",{enumerable:true,get(){throw Error("private event getter");}});
  const sparse=new Array(1);
  class BadClaims extends Array<unknown>{}
  const extended=Object.defineProperty([claimRow()],"secret",{value:"private"});
  const symbol=Object.defineProperty([claimRow()],Symbol("private"),{value:"secret"});
  for(const input of [getter,sparse,new BadClaims(claimRow()),extended,symbol]){
   const t=harness(input);
   await expect(t.run()).resolves.toMatchObject({
    state:"CLAIM_UNVERIFIED",claimed:0,completed:0,providerMessagesSent:0,
   });
   expect(t.from).not.toHaveBeenCalled();
   expect(t.bridge).not.toHaveBeenCalled();
  }
 });
 it("rejects non-data lease rows, proxy traps and bad rows in a mixed batch atomically",async()=>{
  const row=Object.defineProperty(claimRow(),"locked_until",{
   enumerable:true,get(){throw Error("lease getter with PII");},
  });
  const proxy=new Proxy(claimRow(),{
   ownKeys(){throw Error("malicious provider ownKeys");},
  });
  for(const input of [[row],[proxy],[claimRow(),row]]){
   const t=harness(input);
   expect(await t.run()).toMatchObject({state:"CLAIM_UNVERIFIED",claimed:0});
   expect(t.from).not.toHaveBeenCalled();
   expect(t.bridge).not.toHaveBeenCalled();
  }
 });
 it("copies descriptor data rather than trusting a mutable proxy field getter after validation",async()=>{
  const unstable=new Proxy(claimRow(),{
   get(target,key,receiver){
    if(key==="workspace_id" || key==="locked_by")
      throw Error("source changed after validation");
    return Reflect.get(target,key,receiver);
   },
  });
  const t=harness([unstable]);
  expect(await t.run()).toMatchObject({state:"BATCH_PROCESSED",
    claimed:1,completed:1,completionNotVerified:0});
  expect(t.bridge).toHaveBeenCalledOnce();
 });
 it("rejects completion accessor or proxy traps without ACKing a finished journal",async()=>{
  const getter=Object.defineProperty({ok:true,state:"SUCCEEDED"},"state",{
   enumerable:true,get(){throw Error("private receipt getter");},
  });
  const proxy=new Proxy({ok:true,state:"SUCCEEDED"},{
   getPrototypeOf(){throw Error("provider completion proxy");},
  });
  for(const result of [getter,proxy]){
   const t=harness([claimRow()],result);
   await expect(t.run()).resolves.toMatchObject({
     state:"BATCH_PROCESSED",claimed:1,completed:0,
     completionNotVerified:1,providerMessagesSent:0,
   });
   expect(t.bridge).toHaveBeenCalledOnce();
  }
 });
});
