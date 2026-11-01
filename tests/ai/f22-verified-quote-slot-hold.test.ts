import {describe,expect,it,vi} from "vitest";
import {holdOwnerVerifiedQuoteSlot} from "../../src/server/workflows/owner-verified-quote-slot-hold";
const w="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const quote="33333333-3333-4333-8333-333333333333";
const req="44444444-4444-4444-8444-444444444444";
const slot="55555555-5555-4555-8555-555555555555";
const crew="66666666-6666-4666-8666-666666666666";
const user="77777777-7777-4777-8777-777777777777";
const holdId="88888888-8888-4888-8888-888888888888";
const other="99999999-9999-4999-8999-999999999999";
const when=Date.parse("2027-01-01T00:00:00.000Z");
const after="2027-01-01T01:00:00.000Z";
const at="2027-01-02T09:00:00.000Z";
const until="2027-01-02T12:00:00.000Z";
type Row=Record<string,unknown>;
type Opt={role?:string;mode?:string;actorChange?:boolean;thirdChange?:boolean;
 status?:string;crewBranch?:string;capacity?:number;currentNewer?:boolean;
 future?:boolean;hasVisit?:boolean;existingHold?:boolean;expiredHold?:boolean;
 drift?:boolean;badSaved?:Row;duplicate?:boolean;holdFails?:boolean};
function fixture(opts:Opt={}){
 const quoteRow:Row={id:quote,workspace_id:w,request_id:req,status:opts.status??"ACCEPTED",
  version:4,duration_minutes:120,buffer_minutes:30};
 const requestRow:Row={id:req,workspace_id:w,branch_id:branch,version:5};
 const slotRow:Row={id:slot,workspace_id:w,crew_id:crew,
  starts_at:opts.future===false?"2026-01-01T00:00:00.000Z":at,
  ends_at:until,capacity_minutes:opts.capacity??180};
 const crewRow:Row={id:crew,workspace_id:w,branch_id:opts.crewBranch??branch,active:true};
 const activeHold:Row={id:holdId,workspace_id:w,quote_id:quote,slot_id:slot,
  status:"HELD",expires_at:opts.expiredHold?"2026-01-01T00:00:00.000Z":after};
 const holds=opts.existingHold||opts.expiredHold?[activeHold]:[] as Row[];
 const source:Record<string,Row[]>={
  quotes:opts.currentNewer?[quoteRow,{...quoteRow,id:other,version:5}]:[quoteRow],
  requests:[requestRow],capacity_slots:[slotRow],crews:[crewRow],
  slot_holds:holds,visits:opts.hasVisit?[{id:other,workspace_id:w,quote_id:quote}]:[],
 };
 const calls:string[]=[];
 let requestReads=0;let ownerCalls=0;
 const client={
  from(table:string){
   return {select(_fields:string){
    void _fields;const filters:Record<string,unknown>={};let max=100;
    const rows=()=>{
     if(table==="requests")requestReads++;
     let x=(source[table]??[]).filter(r=>
      Object.entries(filters).every(([k,v])=>r[k]===v)).slice(0,max);
     if(table==="requests"&&opts.drift&&requestReads>1)x=x.map(r=>({...r,version:6}));
     return x;
    };
    const query={
     eq(k:string,v:unknown){filters[k]=v;return query;},
     limit(n:number){max=n;return query;},
     async maybeSingle(){calls.push(table+":single");const r=rows();return{data:r.length===1?r[0]:null,error:null};},
     then(done:(v:unknown)=>unknown,fail?:(e:unknown)=>unknown){
      calls.push(table+":list");return Promise.resolve({data:rows(),error:null}).then(done,fail);
     },
    };
    return query;
   }};
  },
 };
 const resolve=vi.fn(async()=>{
  ownerCalls++;
  return {ok:true,value:{
   workspace:{id:w,slug:"test-workspace"},
   actor:{role:opts.role??"OWNER",workspaceId:w,
    userId:opts.actorChange&&ownerCalls===2||opts.thirdChange&&ownerCalls===3?other:user},
   branchScope:{mode:opts.mode??"ALL",branches:[{id:branch}]},
   service:client,
  }};
 });
 const hold=vi.fn(async()=>{
  if(opts.holdFails)return{ok:false,message:"slot unavailable"};
  if(opts.duplicate)holds.push({...activeHold,id:other,expires_at:after});
  holds.push({...activeHold,...opts.badSaved,expires_at:opts.badSaved?.expires_at??after});
  return{ok:true,message:"RPC acknowledged slot held"};
 });
 return {resolve,hold,source,calls};
}
const deps=(f:ReturnType<typeof fixture>)=>({
 resolve:f.resolve as never,hold:f.hold as never,
 mode:()=>"SERVICE_ROLE" as const,now:()=>when,
});
describe("F22 accepted quote → verified saved temporary capacity hold",()=>{
 it("calls existing protected hold only after two complete owner + quote + slot checks",async()=>{
  const f=fixture();
  const r=await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(f));
  expect(r).toMatchObject({ok:true,state:"SAVED_SLOT_HOLD_VERIFIED",
   quoteId:quote,slotId:slot,holdId,bookingConfirmed:false,
   paymentCaptured:false,customerNotified:false,manualFollowUpRequired:true});
  expect(f.resolve).toHaveBeenCalledTimes(3);
  expect(f.hold).toHaveBeenCalledTimes(1);
  expect(f.hold).toHaveBeenCalledWith("test-workspace",quote,slot);
  expect(f.calls.filter(x=>x==="slot_holds:list").length).toBe(5);
 });
 it("refuses invalid slug/ID, same ID and non-service role before access",async()=>{
  const f=fixture();
  for(const [name,q,s] of [["foo/bad",quote,slot],["test-workspace","wrong",slot],
    ["test-workspace",quote,"bad"],["test-workspace",quote,quote]]){
   expect((await holdOwnerVerifiedQuoteSlot(name,q,s,deps(f))).ok).toBe(false);
  }
  expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,{
   ...deps(f),mode:()=>"QA_SESSION_RLS" as never,
  })).toMatchObject({ok:false,code:"BACKEND_UNAVAILABLE"});
  expect(f.resolve).not.toHaveBeenCalled();
 });
 it("denies dispatcher and branch-only roles",async()=>{
  for(const opt of [{role:"DISPATCHER"},{mode:"BRANCH"}]){
   const f=fixture(opt);
   expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(f)))
    .toMatchObject({ok:false,code:"OWNER_REQUIRED"});
   expect(f.hold).not.toHaveBeenCalled();
  }
 });
 it("denies unaccepted and historical/superseded quotes",async()=>{
  for(const opt of [{status:"APPROVED"},{status:"SENT"},
    {currentNewer:true}]){
   const f=fixture(opt);
   expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(f)))
    .toMatchObject({ok:false,code:"SLOT_NOT_ELIGIBLE"});
   expect(f.hold).not.toHaveBeenCalled();
  }
 });
 it("denies foreign crew branch, stale slot, and insufficient capacity",async()=>{
  for(const opt of [{crewBranch:other},{future:false},{capacity:80}]){
   const f=fixture(opt);
   expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(f)))
    .toMatchObject({ok:false,code:"SLOT_NOT_ELIGIBLE"});
   expect(f.hold).not.toHaveBeenCalled();
  }
 });
 it("refuses existing confirmed/active holds and visits, permits expired hold",async()=>{
  for(const opt of [{existingHold:true},{hasVisit:true}]){
   const f=fixture(opt);
   expect((await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(f))).ok).toBe(false);
   expect(f.hold).not.toHaveBeenCalled();
  }
  const expired=fixture({expiredHold:true});
  const r=await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(expired));
  expect(r.ok).toBe(false); // two HELD rows exist after write: ambiguous readback
  expect(expired.hold).toHaveBeenCalledOnce();
 });
 it("source revision drift or changed actor prevents the write",async()=>{
  const drift=fixture({drift:true});
  expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(drift)))
   .toMatchObject({ok:false,code:"SOURCE_CHANGED"});
  expect(drift.hold).not.toHaveBeenCalled();
  const changed=fixture({actorChange:true});
  expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(changed)))
   .toMatchObject({ok:false,code:"SOURCE_CHANGED"});
  expect(changed.hold).not.toHaveBeenCalled();
 });
 it("fails closed when executor rejects, or actor changes after saved write",async()=>{
  const failed=fixture({holdFails:true});
  expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(failed)))
   .toMatchObject({ok:false,code:"HOLD_REJECTED"});
  const changed=fixture({thirdChange:true});
  expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(changed)))
   .toMatchObject({ok:false,code:"READBACK_UNVERIFIED"});
 });
 it("rejects ambiguous or forged post-write hold receipts",async()=>{
  for(const opt of [{duplicate:true},{badSaved:{workspace_id:other}},
    {badSaved:{status:"EXPIRED"}},{badSaved:{slot_id:other}},
    {badSaved:{expires_at:"2026-01-01T00:00:00.000Z"}}]){
   const f=fixture(opt);
   expect(await holdOwnerVerifiedQuoteSlot("test-workspace",quote,slot,deps(f)))
    .toMatchObject({ok:false,code:"READBACK_UNVERIFIED"});
  }
 });
});
