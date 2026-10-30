import {describe,expect,it,vi} from "vitest";
import {calculateOwnerInboxFirstQuote} from "../../src/server/ai/owner-inbox-first-quote";
import {canOfferFirstInboxQuote} from "../../src/features/operations/inbox-first-quote-gate";

const workspace="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const request="33333333-3333-4333-8333-333333333333";
const conversation="44444444-4444-4444-8444-444444444444";
const customer="55555555-5555-4555-8555-555555555555";
const user="66666666-6666-4666-8666-666666666666";
const quote="77777777-7777-4777-8777-777777777777";
const other="88888888-8888-4888-8888-888888888888";
const row=()=>({
 id:quote,workspace_id:workspace,request_id:request,status:"DRAFT",version:1,
 currency:"USD",total_minor:20000,subtotal_minor:18000,tax_minor:2000,
 deposit_minor:5000,balance_minor:15000,duration_minutes:120,
});
type FixtureOptions={actorRole?:string;branchId?:string;status?:string;
 version?:number;rooms?:boolean;staleAfterFirst?:boolean;thirdActor?:boolean;
 existing?:boolean;customerMismatch?:boolean;badResult?:Record<string,unknown>};
function fixture(opts:FixtureOptions={}){
 const saved={
  conversations:[{id:conversation,workspace_id:workspace,branch_id:branch,
   request_id:request,customer_id:customer,version:3}],
  requests:[{id:request,workspace_id:workspace,branch_id:opts.branchId??branch,
   customer_id:opts.customerMismatch?other:customer,status:opts.status??"READY",
   version:opts.version??2,service_id:other,
   bedrooms:opts.rooms===false?null:2,bathrooms:1}],
  quotes:opts.existing?[row()]:[] as Array<Record<string,unknown>>,
 };
 const queries:string[]=[];
 let requestReads=0;
 const service={from:(table:string)=>({
  select:(_columns:string)=>{
   void _columns;
   const filters:Record<string,unknown>={};
   let max=100;
   const list=()=>{
    if(table==="requests")requestReads++;
    return saved[table as keyof typeof saved].filter(r=>
      Object.entries(filters).every(([field,val])=>
       (r as Record<string,unknown>)[field]===val)).slice(0,max).map(r=>
       table==="requests"&&opts.staleAfterFirst&&requestReads>1?
        {...r,version:3}:r);
   };
   const query={
    eq(name:string,value:unknown){filters[name]=value;return query;},
    limit(n:number){max=n;return query;},
    async maybeSingle(){queries.push(table+":single");const rows=list();
      return {data:rows.length===1?rows[0]:null,error:null};},
    then(resolve:(v:unknown)=>unknown,reject?:(e:unknown)=>unknown){
      queries.push(table+":list");
      return Promise.resolve({data:list(),error:null}).then(resolve,reject);
    },
   };
   return query;
  },
 })};
 let authCalls=0;
 const resolve=vi.fn(async()=>{
  authCalls++;
  return {ok:true,value:{
   workspace:{id:workspace,slug:"demo-workspace"},
   actor:{userId:opts.thirdActor&&authCalls===3?other:user,workspaceId:workspace,
    role:opts.actorRole??"OWNER"},
   branchScope:{mode:"ALL",branches:[{id:branch}]},service,rpc:service,
  }};
 });
 const calc=vi.fn(async(_slug:string,_id:string,_extras?:{oven?:boolean})=>{
  if(!opts.badResult) saved.quotes.push(row());
  else saved.quotes.push({...row(),...opts.badResult});
  return {ok:true,message:"Real server calculated and saved quote"};
 });
 return {saved,queries,resolve,calc};
}
const deps=(f:ReturnType<typeof fixture>)=>({
 resolveActor:f.resolve as never,calculate:f.calc as never,
 mode:()=>"SERVICE_ROLE" as const,
});
describe("Inbox initial cleaning quote → existing real-price persistent quote",()=>{
 it("uses authenticated conversation/request and one verifiable saved quote, never browser pricing",async()=>{
  const f=fixture();
  const r=await calculateOwnerInboxFirstQuote("demo-workspace",conversation,deps(f));
  expect(r).toEqual({ok:true,state:"FIRST_QUOTE_SAVED_VERIFIED",
   quoteId:quote,quoteVersion:1,preexistingQuotes:0,
   manualApprovalRequired:true,customerMessageSent:false,providerInvoked:false,
   bookingCreated:false,paymentChanged:false});
  expect(f.resolve).toHaveBeenCalledTimes(3);
  expect(f.calc).toHaveBeenCalledOnce();
  expect(f.calc).toHaveBeenCalledWith("demo-workspace",request,{oven:false});
  expect(f.queries.filter(x=>x==="quotes:list")).toHaveLength(3);
 });
 it("rejects untrusted IDs and no service-role backend without calling calculator",async()=>{
  const f=fixture();
  expect(await calculateOwnerInboxFirstQuote("invalid/slug",conversation,deps(f)))
   .toMatchObject({ok:false,code:"QUOTE_INPUT_INVALID"});
  expect(await calculateOwnerInboxFirstQuote("demo-workspace","someone@example.org",deps(f)))
   .toMatchObject({ok:false,code:"QUOTE_INPUT_INVALID"});
  expect(await calculateOwnerInboxFirstQuote("demo-workspace",conversation,{
   ...deps(f),mode:()=>"QA_SESSION_RLS" as never,
  })).toMatchObject({ok:false,code:"QUOTE_BACKEND_DISABLED"});
  expect(f.resolve).not.toHaveBeenCalled();
  expect(f.calc).not.toHaveBeenCalled();
 });
 it("refuses dispatcher, foreign branch, incomplete rooms and unready request",async()=>{
  for(const opts of [
   {actorRole:"DISPATCHER"},{branchId:other},{rooms:false},
   {status:"COLLECTING"},{status:"QUOTED"},{customerMismatch:true},{version:0},
  ]){
   const f=fixture(opts);
   const r=await calculateOwnerInboxFirstQuote("demo-workspace",conversation,deps(f));
   expect(r.ok).toBe(false);
   expect(f.calc).not.toHaveBeenCalled();
  }
 });
 it("never recalculates an existing quote, including older/superseded offers",async()=>{
  const f=fixture({existing:true});
  expect(await calculateOwnerInboxFirstQuote("demo-workspace",conversation,deps(f)))
   .toMatchObject({ok:false,code:"QUOTE_NOT_READY"});
  expect(f.calc).not.toHaveBeenCalled();
 });
 it("detects saved request revision drift before quote creation",async()=>{
  const f=fixture({staleAfterFirst:true});
  expect(await calculateOwnerInboxFirstQuote("demo-workspace",conversation,deps(f)))
   .toMatchObject({ok:false,code:"QUOTE_SOURCE_CHANGED"});
  expect(f.calc).not.toHaveBeenCalled();
 });
 it("detects revoked or changed identity before persisted readback and never claims completion",async()=>{
  const f=fixture({thirdActor:true});
  expect(await calculateOwnerInboxFirstQuote("demo-workspace",conversation,deps(f)))
   .toMatchObject({ok:false,code:"QUOTE_READBACK_UNVERIFIED"});
 });
 it("rejects forged currency, total or status after the trusted calculator returns",async()=>{
  for(const badResult of [
   {request_id:other},{workspace_id:other},{total_minor:900},
   {status:"SENT"},{currency:"usd"},{duration_minutes:0},{version:0},
  ]){
   const f=fixture({badResult});
   expect(await calculateOwnerInboxFirstQuote("demo-workspace",conversation,deps(f)))
    .toMatchObject({ok:false,code:"QUOTE_READBACK_UNVERIFIED"});
  }
 });
 it("fails closed on a concurrent second quote and on a calculator exception",async()=>{
  const f=fixture();
  const calc=vi.fn(async()=>{
   f.saved.quotes.push(row(),{...row(),id:other,version:2});
   return {ok:true,message:"written"};
  });
  expect(await calculateOwnerInboxFirstQuote("demo-workspace",conversation,{
   ...deps(f),calculate:calc as never,
  })).toMatchObject({ok:false,code:"QUOTE_READBACK_UNVERIFIED"});
  const x=fixture();
  expect(await calculateOwnerInboxFirstQuote("demo-workspace",conversation,{
   ...deps(x),calculate:(async()=>{throw Error("raw stripe secret");}) as never,
  })).toMatchObject({ok:false,code:"QUOTE_PERSIST_FAILED"});
 });
 it("owner UI gate requires saved price evidence and no previous quote",()=>{
  const requestRow={id:request,branchId:branch,status:"READY"};
  const valid={request:requestRow,quotes:[],ownerPricingBookProof:{
    state:"VERIFIED" as const,activeBranchIds:[branch]},serviceRole:true};
  expect(canOfferFirstInboxQuote(valid)).toBe(true);
  expect(canOfferFirstInboxQuote({...valid,serviceRole:false})).toBe(false);
  expect(canOfferFirstInboxQuote({...valid,quotes:[{requestId:request}]})).toBe(false);
  expect(canOfferFirstInboxQuote({...valid,ownerPricingBookProof:{
    state:"UNAVAILABLE",activeBranchIds:[branch]}} as never)).toBe(false);
  expect(canOfferFirstInboxQuote({...valid,request:{...requestRow,status:"CLOSED"}})).toBe(false);
 });
});
