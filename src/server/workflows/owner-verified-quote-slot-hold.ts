import {holdOperationalSlot,resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
type ActorResolver=typeof resolveStaffActor;
type Actor=Extract<Awaited<ReturnType<ActorResolver>>,{ok:true}>["value"];
type HoldExecutor=typeof holdOperationalSlot;
export type VerifiedSlotHoldResult=
 | {ok:false;code:"INVALID_SELECTION"|"BACKEND_UNAVAILABLE"|"OWNER_REQUIRED"|"SAVED_SOURCE_UNAVAILABLE"|"QUOTE_NOT_ACCEPTED"|"SLOT_NOT_ELIGIBLE"|"SOURCE_CHANGED"|"HOLD_REJECTED"|"READBACK_UNVERIFIED"}
 | {ok:true;state:"SAVED_SLOT_HOLD_VERIFIED";holdId:string;quoteId:string;slotId:string;expiresAt:string;
    bookingConfirmed:false;paymentCaptured:false;customerNotified:false;manualFollowUpRequired:true};
export interface VerifiedSlotHoldDeps {
 resolve?:ActorResolver;hold?:HoldExecutor;mode?:typeof operationalDatabaseMode;
 now?:()=>number;
}
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&v.length>=3&&v.length<=40&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const integer=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0;
const deny=(code:Extract<VerifiedSlotHoldResult,{ok:false}>["code"]):VerifiedSlotHoldResult=>({ok:false,code});
const allowed=(v:Awaited<ReturnType<ActorResolver>>,name:string):v is Extract<Awaited<ReturnType<ActorResolver>>,{ok:true}> =>
 v.ok&&v.value.workspace.slug===name&&uuid(v.value.workspace.id)&&uuid(v.value.actor.userId)&&
 v.value.actor.workspaceId===v.value.workspace.id&&v.value.actor.role==="OWNER"&&v.value.branchScope.mode==="ALL";
interface Source{branchId:string;fingerprint:string}
async function checkSource(ctx:Actor,quoteId:string,slotId:string,now:number):Promise<Source|null>{
 const {workspace,service,branchScope}=ctx;
 const qRes=await service.from("quotes").select("id,workspace_id,request_id,status,version,duration_minutes,buffer_minutes")
   .eq("workspace_id",workspace.id).eq("id",quoteId).maybeSingle();
 const q=qRes.data;
 if(qRes.error||!q||q.id!==quoteId||q.workspace_id!==workspace.id||!uuid(q.request_id)||
    q.status!=="ACCEPTED"||!integer(q.version)||!integer(q.duration_minutes)||
    typeof q.buffer_minutes!=="number"||!Number.isSafeInteger(q.buffer_minutes)||q.buffer_minutes<0)return null;
 const reqRes=await service.from("requests").select("id,workspace_id,branch_id,version")
  .eq("workspace_id",workspace.id).eq("id",q.request_id).maybeSingle();
 const request=reqRes.data;
 if(reqRes.error||!request||request.id!==q.request_id||request.workspace_id!==workspace.id||
    !uuid(request.branch_id)||!integer(request.version)||
    !branchScope.branches.some(b=>b.id===request.branch_id))return null;
 // A newer current offer means the accepted quote cannot select capacity.
 const versions=await service.from("quotes").select("id,status,version")
   .eq("workspace_id",workspace.id).eq("request_id",request.id).limit(32);
 if(versions.error||!Array.isArray(versions.data)||versions.data.length>=32||
    versions.data.some(v=>!uuid(v.id)||!integer(v.version)))return null;
 const current=versions.data.filter(v=>v.status!=="SUPERSEDED")
    .sort((a,b)=>b.version-a.version);
 if(current.length!==1||current[0].id!==quoteId||current[0].version!==q.version)return null;
 const slotRes=await service.from("capacity_slots")
   .select("id,workspace_id,crew_id,starts_at,ends_at,capacity_minutes")
   .eq("workspace_id",workspace.id).eq("id",slotId).maybeSingle();
 const slot=slotRes.data;
 if(slotRes.error||!slot||slot.id!==slotId||slot.workspace_id!==workspace.id||
    !uuid(slot.crew_id)||!integer(slot.capacity_minutes)||
    typeof slot.starts_at!=="string"||typeof slot.ends_at!=="string"||
    !Number.isFinite(Date.parse(slot.starts_at))||
    !Number.isFinite(Date.parse(slot.ends_at))||
    Date.parse(slot.starts_at)<=now||Date.parse(slot.ends_at)<=Date.parse(slot.starts_at)||
    q.duration_minutes+q.buffer_minutes>slot.capacity_minutes||
    q.duration_minutes+q.buffer_minutes>(Date.parse(slot.ends_at)-Date.parse(slot.starts_at))/60000)
    return null;
 const crewRes=await service.from("crews").select("id,workspace_id,branch_id,active")
  .eq("workspace_id",workspace.id).eq("id",slot.crew_id).maybeSingle();
 const crew=crewRes.data;
 if(crewRes.error||!crew||crew.id!==slot.crew_id||crew.workspace_id!==workspace.id||
    crew.branch_id!==request.branch_id||crew.active!==true)return null;
 const [holdsByQuote,holdsBySlot,visits]=await Promise.all([
  service.from("slot_holds").select("id,status,expires_at").eq("workspace_id",workspace.id).eq("quote_id",quoteId).limit(12),
  service.from("slot_holds").select("id,status,expires_at").eq("workspace_id",workspace.id).eq("slot_id",slotId).limit(12),
  service.from("visits").select("id").eq("workspace_id",workspace.id).eq("quote_id",quoteId).limit(2),
 ]);
 if(holdsByQuote.error||holdsBySlot.error||visits.error||
    !Array.isArray(holdsByQuote.data)||!Array.isArray(holdsBySlot.data)||
    !Array.isArray(visits.data)||visits.data.length!==0||
    holdsByQuote.data.length>=12||holdsBySlot.data.length>=12)return null;
 const active=(h:{status:unknown;expires_at:unknown})=>
  h.status==="CONFIRMED"||(h.status==="HELD"&&
   (typeof h.expires_at!=="string"||!Number.isFinite(Date.parse(h.expires_at))||Date.parse(h.expires_at)>now));
 if(holdsByQuote.data.some(active)||holdsBySlot.data.some(active))return null;
 return {branchId:request.branch_id,fingerprint:JSON.stringify([
  q.id,q.workspace_id,q.request_id,q.status,q.version,q.duration_minutes,q.buffer_minutes,
  request.id,request.branch_id,request.version,slot.id,slot.crew_id,slot.starts_at,
  slot.ends_at,slot.capacity_minutes,crew.id,crew.branch_id,crew.active,
  holdsByQuote.data.map(h=>[h.id,h.status,h.expires_at]),
  holdsBySlot.data.map(h=>[h.id,h.status,h.expires_at])])};
}
/**
 * Owner-selected accepted quote -> real capacity slot hold. Never a booking.
 * Underlying holdOperationalSlot reauthorizes the exact quote/slot and calls
 * the existing concurrency-aware servicedesk_hold_slot database command.
 * Missing or ambiguous post-write proof is NOT proof of rollback; no retry.
 */
export async function holdOwnerVerifiedQuoteSlot(slugValue:string,quoteId:string,slotId:string,deps:VerifiedSlotHoldDeps={}):Promise<VerifiedSlotHoldResult>{
 if(!slug(slugValue)||!uuid(quoteId)||!uuid(slotId)||quoteId===slotId)return deny("INVALID_SELECTION");
 if((deps.mode??operationalDatabaseMode)()!=="SERVICE_ROLE")return deny("BACKEND_UNAVAILABLE");
 const resolver=deps.resolve??resolveStaffActor;
 const now=(deps.now??Date.now)();
 if(!Number.isFinite(now))return deny("SAVED_SOURCE_UNAVAILABLE");
 let first:Awaited<ReturnType<ActorResolver>>;
 try{first=await resolver(slugValue);}catch{return deny("OWNER_REQUIRED");}
 if(!allowed(first,slugValue))return deny("OWNER_REQUIRED");
 let source:Source|null;
 try{source=await checkSource(first.value,quoteId,slotId,now);}
 catch{return deny("SAVED_SOURCE_UNAVAILABLE");}
 if(!source)return deny("SLOT_NOT_ELIGIBLE");
 let second:Awaited<ReturnType<ActorResolver>>;
 try{second=await resolver(slugValue);}catch{return deny("SOURCE_CHANGED");}
 if(!allowed(second,slugValue)||second.value.actor.userId!==first.value.actor.userId||
    second.value.workspace.id!==first.value.workspace.id||
    !second.value.branchScope.branches.some(b=>b.id===source?.branchId))return deny("SOURCE_CHANGED");
 let before:Source|null;
 try{before=await checkSource(second.value,quoteId,slotId,now);}
 catch{return deny("SOURCE_CHANGED");}
 if(!before||before.fingerprint!==source.fingerprint)return deny("SOURCE_CHANGED");
 let committed:Awaited<ReturnType<HoldExecutor>>;
 try{committed=await (deps.hold??holdOperationalSlot)(slugValue,quoteId,slotId);}
 catch{return deny("HOLD_REJECTED");}
 if(!committed.ok)return deny("HOLD_REJECTED");
 let third:Awaited<ReturnType<ActorResolver>>;
 try{third=await resolver(slugValue);}catch{return deny("READBACK_UNVERIFIED");}
 if(!allowed(third,slugValue)||third.value.actor.userId!==first.value.actor.userId||
    third.value.workspace.id!==first.value.workspace.id||
    !third.value.branchScope.branches.some(b=>b.id===source?.branchId))return deny("READBACK_UNVERIFIED");
 try{
  const result=await third.value.service.from("slot_holds")
   .select("id,workspace_id,quote_id,slot_id,status,expires_at")
   .eq("workspace_id",third.value.workspace.id).eq("quote_id",quoteId)
   .eq("slot_id",slotId).eq("status","HELD").limit(3);
  if(result.error||!Array.isArray(result.data)||result.data.length!==1)return deny("READBACK_UNVERIFIED");
  const h=result.data[0];
  if(!uuid(h.id)||h.workspace_id!==third.value.workspace.id||h.quote_id!==quoteId||
     h.slot_id!==slotId||h.status!=="HELD"||
     typeof h.expires_at!=="string"||!Number.isFinite(Date.parse(h.expires_at))||
     Date.parse(h.expires_at)<=(deps.now??Date.now)())return deny("READBACK_UNVERIFIED");
  return {ok:true,state:"SAVED_SLOT_HOLD_VERIFIED",holdId:h.id,quoteId,slotId,expiresAt:h.expires_at,
   bookingConfirmed:false,paymentCaptured:false,customerNotified:false,manualFollowUpRequired:true};
 }catch{return deny("READBACK_UNVERIFIED");}
}
