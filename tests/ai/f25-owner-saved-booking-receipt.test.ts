import {describe,it,expect,vi} from "vitest";
import {loadOwnerSavedBookingReceipt} from "../../src/server/ai/owner-saved-booking-receipt";
const w="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const quote="33333333-3333-4333-8333-333333333333";
const request="44444444-4444-4444-8444-444444444444";
const visit="55555555-5555-4555-8555-555555555555";
const hold="66666666-6666-4666-8666-666666666666";
const slot="77777777-7777-4777-8777-777777777777";
const crew="88888888-8888-4888-8888-888888888888";
const invoice="99999999-9999-4999-8999-999999999999";
const payment="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ownerId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const foreign="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
type Row=Record<string,unknown>;
type Options={type?:string;branch?:string;ownerId?:string;duplicateVisit?:boolean};
function fixture(opts:Options={}){
 const tables:Record<string,Row[]>={
  quotes:[{id:quote,workspace_id:w,request_id:request,status:"ACCEPTED",
    version:3,deposit_minor:2000,currency:"USD"}],
  requests:[{id:request,workspace_id:w,branch_id:branch}],
  visits:[{id:visit,workspace_id:w,request_id:request,quote_id:quote,
    hold_id:hold,slot_id:slot,crew_id:crew,status:"SCHEDULED",
    starts_at:"2026-12-01T09:00:00.000Z",ends_at:"2026-12-01T11:30:00.000Z",version:1}],
  slot_holds:[{id:hold,workspace_id:w,slot_id:slot,quote_id:quote,status:"CONFIRMED"}],
  capacity_slots:[{id:slot,workspace_id:w,crew_id:crew,
    starts_at:"2026-12-01T09:00:00.000Z",ends_at:"2026-12-01T12:00:00.000Z"}],
  crews:[{id:crew,workspace_id:w,branch_id:branch}],
  invoices:[{id:invoice,workspace_id:w,quote_id:quote,visit_id:visit,
    status:"PARTIALLY_PAID",currency:"USD",total_minor:10000,allocated_minor:2000,
    refunded_minor:0,balance_minor:8000}],
  verified_payment_applications:[{id:payment,workspace_id:w,quote_id:quote,hold_id:hold,
    invoice_id:invoice,purpose:"DEPOSIT",state:"APPLIED",amount_minor:2000,currency:"USD"}],
 };
 if(opts.duplicateVisit)tables.visits.push({...tables.visits[0],id:foreign});
 const calls:string[]=[];
 const service={from(table:string){return{select(_columns:string){
  void _columns;const filters:Record<string,unknown>={};let limit=100;
  const list=()=> (tables[table]??[]).filter(row=>
   Object.entries(filters).every(([key,value])=>row[key]===value)).slice(0,limit);
  const q={
   eq(k:string,v:unknown){filters[k]=v;return q;},
   limit(n:number){limit=n;return q;},
   async maybeSingle(){calls.push(table+":one");const rows=list();
    return{data:rows.length===1?rows[0]:null,error:null};},
   then(done:(v:unknown)=>unknown,fail?:(e:unknown)=>unknown){
    calls.push(table+":list");return Promise.resolve({data:list(),error:null}).then(done,fail);},
  };
  return q;
 }};}};
 let count=0;
 const resolve=vi.fn(async()=>{count++;return{ok:true,value:{
  workspace:{id:w,slug:"demo-workspace"},
  actor:{userId:opts.ownerId??ownerId,role:opts.type??"OWNER",workspaceId:w},
  branchScope:{mode:"ALL",branches:[{id:opts.branch??branch}]},service,
 }};});
 return{tables,calls,resolve};
}
const deps=(f:ReturnType<typeof fixture>)=>({
 resolveActor:f.resolve as never,mode:()=>"SERVICE_ROLE" as const,
});
describe("F25 owner saved booking with applied deposit — real row query path",()=>{
 it("requires matching accepted quote, confirmed hold, visit, invoice, provider application twice",async()=>{
  const f=fixture();
  const value=await loadOwnerSavedBookingReceipt("demo-workspace",quote,deps(f));
  expect(value).toMatchObject({ok:true,value:{
   state:"SAVED_BOOKING_WITH_APPLIED_DEPOSIT",quoteId:quote,visitId:visit,invoiceId:invoice,
   quoteVersion:3,visitStatus:"SCHEDULED",invoiceStatus:"PARTIALLY_PAID",
   evidence:"TWO_OWNER_AUTHORIZED_SAVED_RECORD_READS",
   recordedDepositApplication:true,bookingRecordPresent:true,
   customerMessageSent:false,newPaymentProcessed:false,newBookingCreated:false,
   manualReviewRecommended:true,
  }});
  expect(f.resolve).toHaveBeenCalledTimes(2);
  expect(f.calls.filter(x=>x==="verified_payment_applications:list")).toHaveLength(2);
  expect(f.calls.filter(x=>x==="visits:list")).toHaveLength(2);
 });
 it("fails before row reads on invalid selectors, disabled backend, nonowner",async()=>{
  const f=fixture();
  expect(await loadOwnerSavedBookingReceipt("bad/slug",quote,deps(f)))
   .toMatchObject({ok:false,code:"INVALID_INPUT"});
  expect(await loadOwnerSavedBookingReceipt("demo-workspace","not-a-uuid",deps(f)))
   .toMatchObject({ok:false,code:"INVALID_INPUT"});
  expect(await loadOwnerSavedBookingReceipt("demo-workspace",quote,{
   ...deps(f),mode:()=>"QA_SESSION_RLS" as never,
  })).toMatchObject({ok:false,code:"BACKEND_UNAVAILABLE"});
  expect(f.resolve).not.toHaveBeenCalled();
  const dispatcher=fixture({type:"DISPATCHER"});
  expect(await loadOwnerSavedBookingReceipt("demo-workspace",quote,deps(dispatcher)))
   .toMatchObject({ok:false,code:"OWNER_REQUIRED"});
  expect(dispatcher.calls).toHaveLength(0);
 });
 it("rejects quote without matching branch membership, duplicate visit or missing deposit",async()=>{
  const otherBranch=fixture({branch:foreign});
  expect((await loadOwnerSavedBookingReceipt("demo-workspace",quote,deps(otherBranch))).ok).toBe(false);
  const duplicated=fixture({duplicateVisit:true});
  expect((await loadOwnerSavedBookingReceipt("demo-workspace",quote,deps(duplicated))).ok).toBe(false);
  const noPayment=fixture();noPayment.tables.verified_payment_applications=[];
  expect((await loadOwnerSavedBookingReceipt("demo-workspace",quote,deps(noPayment))).ok).toBe(false);
 });
 it("denies unconfirmed holds, missing or incorrect provider-deposit evidence, and mismatched rows",async()=>{
  const changes:Array<{table:string;field:string;value:unknown}>= [
    {table:"quotes",field:"status",value:"SENT"},
    {table:"quotes",field:"deposit_minor",value:0},
    {table:"slot_holds",field:"status",value:"HELD"},
    {table:"slot_holds",field:"quote_id",value:foreign},
    {table:"visits",field:"request_id",value:foreign},
    {table:"visits",field:"status",value:"CANCELLED"},
    {table:"visits",field:"crew_id",value:foreign},
    {table:"capacity_slots",field:"ends_at",value:"2026-12-01T10:00:00.000Z"},
    {table:"crews",field:"branch_id",value:foreign},
    {table:"invoices",field:"visit_id",value:foreign},
    {table:"invoices",field:"refunded_minor",value:1000},
    {table:"invoices",field:"status",value:"VOID"},
    {table:"verified_payment_applications",field:"state",value:"REVIEW"},
    {table:"verified_payment_applications",field:"amount_minor",value:1900},
    {table:"verified_payment_applications",field:"invoice_id",value:foreign},
  ];
  for(const c of changes){
   const f=fixture();f.tables[c.table][0][c.field]=c.value;
   const result=await loadOwnerSavedBookingReceipt("demo-workspace",quote,deps(f));
   expect(result,c.table+":"+c.field).toMatchObject({ok:false,code:"SAVED_BOOKING_UNVERIFIED"});
  }
 });
 it("rechecks owner identity and source fingerprint before claiming a booked visit",async()=>{
  const f=fixture();
  let auth=0;
  const changed=await loadOwnerSavedBookingReceipt("demo-workspace",quote,{
   ...deps(f),resolveActor:(async()=>{
    const res=await f.resolve(); auth++;
    if(auth===2)return{...res,value:{...res.value,actor:{...res.value.actor,userId:foreign}}};
    return res;
   }) as never,
  });
  expect(changed).toMatchObject({ok:false,code:"SOURCE_CHANGED"});
  const g=fixture();let readCount=0;
  const initial=await loadOwnerSavedBookingReceipt("demo-workspace",quote,{
   ...deps(g),read:(async()=>{
    readCount++;
    return {workspaceId:w,branchId:branch,quoteId:quote,quoteVersion:3,
     visitId:visit,invoiceId:invoice,startsAt:"2026-12-01T09:00:00.000Z",
     visitStatus:"SCHEDULED",invoiceStatus:"PARTIALLY_PAID",
     fingerprint:readCount===1?"saved-original":"changed-payment-row"};
   }) as never,
  });
  expect(initial).toMatchObject({ok:false,code:"SOURCE_CHANGED"});
 });
});
