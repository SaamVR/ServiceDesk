import {describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {releaseOwnerVerifiedQuoteHold} from "../../src/server/workflows/owner-verified-quote-hold-release";

const ws="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const quote="33333333-3333-4333-8333-333333333333";
const req="44444444-4444-4444-8444-444444444444";
const slot="55555555-5555-4555-8555-555555555555";
const crew="66666666-6666-4666-8666-666666666666";
const owner="77777777-7777-4777-8777-777777777777";
const hold="88888888-8888-4888-8888-888888888888";
const foreign="99999999-9999-4999-8999-999999999999";
const now=Date.parse("2027-01-01T00:00:00.000Z");
const expiry="2027-01-02T00:00:00.000Z";
type Row=Record<string,unknown>;
type Opt={role?:string;scope?:string;holdStatus?:string;expired?:boolean;
 quoteStatus?:string;quoteNewer?:boolean;foreignCrew?:boolean;hasVisit?:boolean;
 hasPayment?:boolean;drift?:boolean;actorChange?:boolean;afterChange?:boolean;
 rejectUpdate?:boolean;readbackBad?:boolean;extendBeforeRelease?:boolean;forgedRpc?:boolean};
function fixture(opt:Opt={}){
 const holdRow:Row={id:hold,workspace_id:ws,quote_id:quote,slot_id:slot,
  status:opt.holdStatus??"HELD",expires_at:opt.expired?"2026-01-01T00:00:00.000Z":expiry};
 const reqRow:Row={id:req,workspace_id:ws,branch_id:branch,version:5};
 const quoteRow:Row={id:quote,workspace_id:ws,request_id:req,
  status:opt.quoteStatus??"ACCEPTED",version:4};
 const source:Record<string,Row[]>={
  slot_holds:[holdRow],
  quotes:opt.quoteNewer?[quoteRow,{...quoteRow,id:foreign,version:6}]:[quoteRow],
  requests:[reqRow],
  capacity_slots:[{id:slot,workspace_id:ws,crew_id:crew,starts_at:"2027-01-03T10:00:00.000Z"}],
  crews:[{id:crew,workspace_id:ws,branch_id:opt.foreignCrew?foreign:branch,active:true}],
  visits:opt.hasVisit?[{id:foreign,workspace_id:ws,quote_id:quote,hold_id:foreign}]:[],
  verified_payment_applications:opt.hasPayment?[{id:foreign,workspace_id:ws,quote_id:quote,hold_id:foreign}]:[],
 };
 let ownerCalls=0,reqReads=0,mutations=0;
 const from=vi.fn((table:string)=>{
  const make=(patch?:Row)=>{
   const equal:Record<string,unknown>={};
   const greater:Record<string,unknown>={};
   let max=100;
   const rows=()=>{
    if(table==="requests")reqReads++;
    const list=(source[table]??[]).filter(row=>
     Object.entries(equal).every(([k,v])=>row[k]===v)&&
     Object.entries(greater).every(([k,v])=>Date.parse(String(row[k]))>Date.parse(String(v))));
    const selected=list.slice(0,max);
    if(table==="requests"&&opt.drift&&reqReads>1)
     return selected.map(row=>({...row,version:6}));
    return selected;
   };
   const query={
    eq(k:string,v:unknown){equal[k]=v;return query;},
    gt(k:string,v:unknown){greater[k]=v;return query;},
    limit(n:number){max=n;return query;},
    select(_columns:string){return query;},
    async maybeSingle(){
     const results=rows();
     if(patch){
      mutations++;
      if(opt.rejectUpdate||results.length!==1)return {data:null,error:null};
      Object.assign(results[0],patch);
      return {data:{...results[0]},error:null};
     }
     if(table==="slot_holds"&&opt.readbackBad&&
        holdRow.status==="RELEASED")return {data:{...results[0],status:"CONFIRMED"},error:null};
     return {data:results.length===1?results[0]:null,error:null};
    },
    then(done:(v:unknown)=>unknown,fail?:(e:unknown)=>unknown){
     return Promise.resolve({data:rows(),error:null}).then(done,fail);
    },
   };
   return query;
  };
  return {select(_columns:string){return make();},update(patch:Row){return make(patch);}};
 });
 // The installed candidate RPC owns the quote/hold transaction; this mock
 // simulates its exact checked commit, not a direct service-role table UPDATE.
 let rpcCalls=0;
 const rpc=vi.fn(async(fn:string,args:{p_input:Record<string,unknown>})=>{
  rpcCalls++;
  if(fn!=="servicedesk_release_held_slot_atomic")throw Error("Unexpected RPC");
  const input=args.p_input;
  if(opt.extendBeforeRelease)
   holdRow.expires_at="2027-01-02T06:00:00.000Z";
  if(opt.rejectUpdate||holdRow.status!=="HELD"||
     input.workspaceId!==ws||input.actorUserId!==owner||
     input.holdId!==hold||input.quoteId!==quote||input.slotId!==slot||
     input.expiresAt!==holdRow.expires_at)
    return {data:{ok:false,code:"HOLD_NOT_ELIGIBLE"},error:null};
  mutations++;
  holdRow.status="RELEASED";
  return {data:opt.forgedRpc?{ok:true,state:"HOLD_RELEASED",
   holdId:foreign,quoteId:quote,slotId:slot,
   newCapacityVerified:false,paymentChanged:false,customerMessaged:false}:{
   ok:true,state:"HOLD_RELEASED",holdId:hold,quoteId:quote,slotId:slot,
   newCapacityVerified:false,paymentChanged:false,customerMessaged:false},error:null};
 });
 const resolver=vi.fn(async()=>{
  ownerCalls++;
  return {ok:true,value:{
    workspace:{id:ws,slug:"test-workspace"},
    actor:{role:opt.role??"OWNER",workspaceId:ws,
      userId:(opt.actorChange&&ownerCalls===2)||(opt.afterChange&&ownerCalls===3)?foreign:owner},
    branchScope:{mode:opt.scope??"ALL",branches:[{id:branch}]},
    service:{from,rpc},
  }};
 });
 const deps={enabled:()=>true,atomicReady:()=>true,mode:()=> "SERVICE_ROLE" as const,
  resolve:resolver as never,now:()=>now};
 return {source,holdRow,from,rpc,resolver,deps,mutations:()=>mutations,rpcCalls:()=>rpcCalls};
}
describe("F23 accepted quote -> manually verified unused HELD slot release",()=>{
 it("requires explicit opt-in before actor lookup or mutation",async()=>{
  const f=fixture();
  expect(await releaseOwnerVerifiedQuoteHold("test-workspace",quote,hold,{
   ...f.deps,enabled:()=>false,
  })).toMatchObject({ok:false,code:"NOT_ACTIVATED"});
  expect(f.resolver).not.toHaveBeenCalled();
  expect(f.mutations()).toBe(0);
 });
 it("second independent atomic-install approval gate defaults to denial before any DB access",async()=>{
  const f=fixture();
  expect(await releaseOwnerVerifiedQuoteHold("test-workspace",quote,hold,{
   ...f.deps,atomicReady:()=>false,
  })).toMatchObject({ok:false,code:"NOT_ACTIVATED"});
  expect(f.resolver).not.toHaveBeenCalled();
  expect(f.mutations()).toBe(0);
 });
 it("releases one exact saved unused hold after double owner and source readback",async()=>{
  const f=fixture();
  expect(await releaseOwnerVerifiedQuoteHold("test-workspace",quote,hold,f.deps))
   .toMatchObject({ok:true,state:"SAVED_HOLD_RELEASE_VERIFIED",
     quoteId:quote,holdId:hold,slotId:slot,bookingCreated:false,
     paymentChanged:false,customerNotified:false,newCapacityUnverified:true});
  expect(f.resolver).toHaveBeenCalledTimes(3);
  expect(f.holdRow.status).toBe("RELEASED");
  expect(f.mutations()).toBe(1);
 });
 it("rejects unsafe inputs, roles, branch scope and stale holds",async()=>{
  for(const options of [{role:"DISPATCHER"},{scope:"BRANCH"},
    {holdStatus:"CONFIRMED"},{expired:true},{quoteStatus:"SENT"},
    {quoteNewer:true},{foreignCrew:true},{hasVisit:true},{hasPayment:true}]){
   const f=fixture(options);
   const r=await releaseOwnerVerifiedQuoteHold("test-workspace",quote,hold,f.deps);
   expect(r.ok).toBe(false);
   expect(f.mutations()).toBe(0);
  }
  const f=fixture();
  for(const [slug,q,h] of [["wrong/path",quote,hold],
    ["test-workspace","bad",hold],["test-workspace",quote,"bad"],
    ["test-workspace",quote,quote]]){
   expect((await releaseOwnerVerifiedQuoteHold(slug,q,h,f.deps)).ok).toBe(false);
  }
  expect(f.resolver).not.toHaveBeenCalled();
 });
 it("refuses to release a hold whose expiry was extended after both owner source reads",async()=>{
  const f=fixture({extendBeforeRelease:true});
  expect(await releaseOwnerVerifiedQuoteHold("test-workspace",quote,hold,f.deps))
   .toMatchObject({ok:false,code:"RELEASE_UNVERIFIED"});
  // The database RPC rejects the stale CAS before writing.
  expect(f.rpcCalls()).toBe(1);
  expect(f.mutations()).toBe(0);
  expect(f.holdRow.status).toBe("HELD");
  expect(f.holdRow.expires_at).toBe("2027-01-02T06:00:00.000Z");
 });
 it("blocks source drift and owner revocation before CAS mutation",async()=>{
  for(const options of [{drift:true},{actorChange:true}]){
   const f=fixture(options);
   expect((await releaseOwnerVerifiedQuoteHold("test-workspace",quote,hold,f.deps)).ok).toBe(false);
   expect(f.mutations()).toBe(0);
  }
 });
 it("refuses stale CAS, post-write owner revocation and unverifiable readback",async()=>{
  for(const options of [{rejectUpdate:true},{afterChange:true},{readbackBad:true},{forgedRpc:true}]){
   const f=fixture(options);
   expect((await releaseOwnerVerifiedQuoteHold("test-workspace",quote,hold,f.deps)).ok).toBe(false);
   expect(f.rpcCalls()).toBe(1);
   expect(f.mutations()).toBe(options.rejectUpdate?0:1);
  }
 });
 it("has real action + authorizing Quotes panel, no provider or visit creation",()=>{
  const backend=readFileSync("src/server/workflows/owner-verified-quote-hold-release.ts","utf8");
  const action=readFileSync("src/features/operations/verified-hold-release-action.ts","utf8");
  const panel=readFileSync("src/features/operations/OwnerQuoteHoldReleasePanel.tsx","utf8");
  const ui=readFileSync("src/features/operations/OwnerSavedHoldReleaseControls.tsx","utf8");
  const route=readFileSync("src/app/app/[workspace]/quotes/page.tsx","utf8");
  expect(backend).toContain('ctx.service.rpc("servicedesk_release_held_slot_atomic"');
  expect(backend).toContain('input.expiresAt');
  expect(backend).not.toContain('.update({status:"RELEASED"');
  expect(backend).toContain('service.from("verified_payment_applications")');
  expect(backend).toContain('service.from("visits")');
  expect(action).toContain('"use server"');
  expect(panel).toContain('process.env.SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED!=="true"');
  expect(panel).toContain('snapshot.value.actor.role!=="OWNER"');
  expect(ui).toContain('onClick={()=>void release()}');
  expect(ui).toContain('no automatic retry was attempted');
  expect(route).toContain('<OwnerQuoteHoldReleasePanel workspaceSlug={workspace} selectedQuoteId={query.quote}/>');
  for(const file of [backend,action,ui,panel])for(const forbidden of [
    "createVisit(","confirmBooking(","capturePayment(","sendEmail(",
    "sendWhatsApp(","applyPayment(","createClient("]){
     expect(file).not.toContain(forbidden);
  }
 });
});
