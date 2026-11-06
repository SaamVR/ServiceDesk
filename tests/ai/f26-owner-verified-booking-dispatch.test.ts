import {describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {dispatchOwnerVerifiedBookedVisit} from "../../src/server/workflows/owner-verified-booking-dispatch";
const workspace="11111111-1111-4111-8111-111111111111";
const user="22222222-2222-4222-8222-222222222222";
const quote="33333333-3333-4333-8333-333333333333";
const visit="44444444-4444-4444-8444-444444444444";
const invoice="55555555-5555-4555-8555-555555555555";
const other="66666666-6666-4666-8666-666666666666";
const saved=(status="SCHEDULED")=>({
 ok:true as const,value:{state:"SAVED_BOOKING_WITH_APPLIED_DEPOSIT" as const,
 quoteId:quote,visitId:visit,invoiceId:invoice,startsAt:"2027-03-01T10:00:00.000Z",
 visitStatus:status,quoteVersion:4,invoiceStatus:"PARTIALLY_PAID",
 evidence:"TWO_OWNER_AUTHORIZED_SAVED_RECORD_READS" as const,
 recordedDepositApplication:true as const,bookingRecordPresent:true as const,
 customerMessageSent:false as const,newPaymentProcessed:false as const,
 newBookingCreated:false as const,manualReviewRecommended:true as const,
 }});
function fixture(options:{role?:string;changedSecond?:boolean;changedThird?:boolean;
 failedTransition?:boolean;preStatus?:string;postStatus?:string;
 changedPostInvoice?:boolean;missingPrePayment?:boolean;
 secondProof?: "wrong_quote"|"wrong_state"|"no_applied_deposit"|"no_saved_booking";
 }={}){
 let ownerReads=0,receiptReads=0,transitioned=false;
 const resolve=vi.fn(async()=>{
  ownerReads++;
  const actorId=options.changedSecond&&ownerReads===2||
    options.changedThird&&ownerReads===3?other:user;
  return {ok:true,value:{
    workspace:{slug:"demo-workspace",id:workspace},
    actor:{userId:actorId,role:options.role??"OWNER",workspaceId:workspace},
    branchScope:{mode:"ALL",branches:[{id:other}]},
  }};
 });
 const loadBooking=vi.fn(async()=>{
  receiptReads++;
  if(receiptReads<3){
   if(options.missingPrePayment)return {ok:false,code:"SAVED_BOOKING_UNVERIFIED"};
   const original=saved(options.preStatus??"SCHEDULED");
   if(receiptReads===2&&options.secondProof){
    if(options.secondProof==="wrong_quote")
     return {ok:true,value:{...original.value,quoteId:other}};
    if(options.secondProof==="wrong_state")
     return {ok:true,value:{...original.value,state:"UNVERIFIED_BOOKING"}};
    if(options.secondProof==="no_applied_deposit")
     return {ok:true,value:{...original.value,recordedDepositApplication:false}};
    if(options.secondProof==="no_saved_booking")
     return {ok:true,value:{...original.value,bookingRecordPresent:false}};
   }
   return original;
  }
  return {ok:true,value:{...saved(options.postStatus??(transitioned?"ASSIGNED":"SCHEDULED")).value,
    invoiceId:options.changedPostInvoice?other:invoice}};
 });
 const transition=vi.fn(async()=>{
  if(options.failedTransition)return {ok:false,message:"visit moved"};
  transitioned=true;return {ok:true,message:"assigned"};
 });
 const deps={enabled:()=>true,mode:()=> "SERVICE_ROLE" as const,
  resolve:resolve as never,loadBooking:loadBooking as never,
  transition:transition as never};
 return {deps,resolve,loadBooking,transition};
}
describe("F26 owner paid booked visit -> persisted ASSIGNED transition",()=>{
 it("does no source read or write when feature flag off",async()=>{
  const f=fixture();
  expect(await dispatchOwnerVerifiedBookedVisit("demo-workspace",quote,visit,{
   ...f.deps,enabled:()=>false,
  })).toEqual({ok:false,code:"NOT_ACTIVATED"});
  expect(f.resolve).not.toHaveBeenCalled();
  expect(f.transition).not.toHaveBeenCalled();
 });
 it("uses exact paid-booking preproof, two same-owner checks, command and independent postproof",async()=>{
  const f=fixture();
  expect(await dispatchOwnerVerifiedBookedVisit("demo-workspace",quote,visit,f.deps))
   .toMatchObject({ok:true,state:"SAVED_VISIT_ASSIGNED_VERIFIED",
    quoteId:quote,visitId:visit,visitStatus:"ASSIGNED",paymentProcessed:false,
    newBookingCreated:false,customerMessaged:false,providerDeliveryVerified:false,
    calendarOutboxMayBeQueued:true});
  expect(f.resolve).toHaveBeenCalledTimes(3);
  expect(f.loadBooking).toHaveBeenCalledTimes(3);
  expect(f.transition).toHaveBeenCalledTimes(1);
  expect(f.transition).toHaveBeenCalledWith("demo-workspace",visit,"ASSIGN");
 });
 it("rejects invalid selection, backend mode, nonowner before any visit transition",async()=>{
  const f=fixture();
  for(const args of [
   ["bad/slug",quote,visit],["demo-workspace","bad",visit],
   ["demo-workspace",quote,"bad"],["demo-workspace",quote,quote],
  ])expect((await dispatchOwnerVerifiedBookedVisit(...args as [string,string,string],f.deps)).ok).toBe(false);
  expect(f.resolve).not.toHaveBeenCalled();
  const x=fixture();
  expect((await dispatchOwnerVerifiedBookedVisit("demo-workspace",quote,visit,{
   ...x.deps,mode:()=> "QA_SESSION_RLS" as never,
  })).ok).toBe(false);
  const dispatcher=fixture({role:"DISPATCHER"});
  expect((await dispatchOwnerVerifiedBookedVisit("demo-workspace",quote,visit,dispatcher.deps)).ok).toBe(false);
  expect(dispatcher.transition).not.toHaveBeenCalled();
 });
 it("rejects unavailable payment and unscheduled visit, never transitions",async()=>{
  for(const o of [{missingPrePayment:true},{preStatus:"ASSIGNED"},
    {preStatus:"CANCELLED"},{preStatus:"HELD"}]){
   const f=fixture(o);
   expect((await dispatchOwnerVerifiedBookedVisit("demo-workspace",quote,visit,f.deps)).ok).toBe(false);
   expect(f.transition).not.toHaveBeenCalled();
  }
 });
 it("vetoes revoked saved-booking proof on the second pre-write read",async()=>{
  for(const secondProof of ["wrong_quote","wrong_state",
    "no_applied_deposit","no_saved_booking"] as const){
   const f=fixture({secondProof});
   expect(await dispatchOwnerVerifiedBookedVisit("demo-workspace",quote,visit,f.deps))
    .toMatchObject({ok:false,code:"SOURCE_CHANGED"});
   expect(f.transition,secondProof).not.toHaveBeenCalled();
   expect(f.loadBooking).toHaveBeenCalledTimes(2);
  }
 });
 it("stops on changed current actor or failed visit command",async()=>{
  for(const o of [{changedSecond:true},{failedTransition:true}]){
   const f=fixture(o);
   expect((await dispatchOwnerVerifiedBookedVisit("demo-workspace",quote,visit,f.deps)).ok).toBe(false);
   if(o.changedSecond)expect(f.transition).not.toHaveBeenCalled();
  }
 });
 it("unverified post-write identity or saved booking cannot produce false success",async()=>{
  for(const o of [{changedThird:true},{postStatus:"SCHEDULED"},
    {postStatus:"CANCELLED"},{changedPostInvoice:true}]){
   const f=fixture(o);
   expect(await dispatchOwnerVerifiedBookedVisit("demo-workspace",quote,visit,f.deps))
    .toMatchObject({ok:false,code:"POST_WRITE_UNVERIFIED"});
   expect(f.transition).toHaveBeenCalledTimes(1);
  }
 });
 it("server action + rendered UI require real F25 paid-booking proof and no send",()=>{
  const core=readFileSync("src/server/workflows/owner-verified-booking-dispatch.ts","utf8");
  const action=readFileSync("src/features/operations/owner-verified-dispatch-action.ts","utf8");
  const ui=readFileSync("src/features/operations/OwnerVerifiedBookingDispatchControls.tsx","utf8");
  const panel=readFileSync("src/features/operations/OwnerSavedBookingReceiptPanel.tsx","utf8");
  expect(core).toContain('SERVICEDESK_F26_OWNER_DISPATCH_ENABLED');
  expect(core).toContain('before.value.recordedDepositApplication!==true');
  expect(core).toContain('visitStatus!=="ASSIGNED"');
  expect(core).toContain('workspaceSlug,visitId,"ASSIGN"');
  expect(action).toContain('"use server"');
  expect(panel).toContain('v.visitStatus==="SCHEDULED"');
  expect(panel).toContain('process.env.SERVICEDESK_F26_OWNER_DISPATCH_ENABLED==="true"');
  expect(ui).toContain("no automatic retry was attempted");
  for(const f of [core,action,ui,panel]){
    for(const forbidden of ["sendEmail(","sendWhatsApp(","processPayment(",
      "applyVerifiedPayment(","createVisit(","newBooking(","capturePayment("]){
      expect(f).not.toContain(forbidden);
    }
  }
 });
});
