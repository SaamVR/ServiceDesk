import {resolveStaffActor} from "@/features/operations/operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";

type Resolver=typeof resolveStaffActor;
type Found=Extract<Awaited<ReturnType<Resolver>>,{ok:true}>;
type Actor=Found["value"];
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const slug=(v:unknown):v is string=>typeof v==="string"&&
 v.length>=3&&v.length<=40&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const integer=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0;
const approved=(v:Awaited<ReturnType<Resolver>>,s:string):v is Found=>
 v.ok&&v.value.workspace.slug===s&&uuid(v.value.workspace.id)&&
 uuid(v.value.actor.userId)&&v.value.actor.role==="OWNER"&&
 v.value.actor.workspaceId===v.value.workspace.id&&
 v.value.branchScope.mode==="ALL";

type Source={branchId:string;slotId:string;expiresAt:string;fingerprint:string};
export type OwnerHoldReleaseResult=
 | {ok:false;code:"NOT_ACTIVATED"|"INVALID_SELECTION"|"OWNER_REQUIRED"|
   "SOURCE_UNAVAILABLE"|"HOLD_NOT_RELEASABLE"|"SOURCE_CHANGED"|
   "RELEASE_UNVERIFIED"}
 | {ok:true;state:"SAVED_HOLD_RELEASE_VERIFIED";holdId:string;quoteId:string;
   slotId:string;bookingCreated:false;paymentChanged:false;
   customerNotified:false;newCapacityUnverified:true};
export interface OwnerHoldReleaseDeps {
 enabled?:()=>boolean;mode?:typeof operationalDatabaseMode;
 resolve?:Resolver;now?:()=>number;
 release?:(ctx:Actor,input:{holdId:string;quoteId:string;slotId:string;
   expiresAt:string;now:string})=>Promise<boolean>;
}
const deny=(code:Extract<OwnerHoldReleaseResult,{ok:false}>["code"]):OwnerHoldReleaseResult=>
 ({ok:false,code});
const rowsValid=(v:unknown,max:number):v is Record<string,unknown>[]=>
 Array.isArray(v)&&v.length<max&&v.every(x=>x!==null&&typeof x==="object"&&!Array.isArray(x));
async function checkSource(ctx:Actor,quoteId:string,holdId:string,now:number):Promise<Source|null>{
 const {workspace,branchScope,service}=ctx;
 const holdRes=await service.from("slot_holds")
  .select("id,workspace_id,quote_id,slot_id,status,expires_at")
  .eq("workspace_id",workspace.id).eq("id",holdId).maybeSingle();
 const h=holdRes.data;
 if(holdRes.error||!h||h.id!==holdId||h.workspace_id!==workspace.id||
    h.quote_id!==quoteId||!uuid(h.slot_id)||h.status!=="HELD"||
    typeof h.expires_at!=="string"||!Number.isFinite(Date.parse(h.expires_at))||
    Date.parse(h.expires_at)<=now)return null;

 const qRes=await service.from("quotes")
  .select("id,workspace_id,request_id,status,version")
  .eq("workspace_id",workspace.id).eq("id",quoteId).maybeSingle();
 const q=qRes.data;
 if(qRes.error||!q||q.id!==quoteId||q.workspace_id!==workspace.id||
   !uuid(q.request_id)||q.status!=="ACCEPTED"||!integer(q.version))return null;
 const requestRes=await service.from("requests")
  .select("id,workspace_id,branch_id,version")
  .eq("workspace_id",workspace.id).eq("id",q.request_id).maybeSingle();
 const req=requestRes.data;
 if(requestRes.error||!req||req.id!==q.request_id||
   req.workspace_id!==workspace.id||!uuid(req.branch_id)||!integer(req.version)||
   !branchScope.branches.some(b=>b.id===req.branch_id))return null;
 const versionRes=await service.from("quotes").select("id,status,version")
  .eq("workspace_id",workspace.id).eq("request_id",req.id).limit(32);
 if(versionRes.error||!rowsValid(versionRes.data,32)||
   versionRes.data.some(v=>!uuid(v.id)||!integer(v.version)))return null;
 const current=versionRes.data.filter(v=>v.status!=="SUPERSEDED");
 if(current.length!==1||current[0].id!==quoteId||current[0].version!==q.version)return null;

 const slotRes=await service.from("capacity_slots")
  .select("id,workspace_id,crew_id,starts_at")
  .eq("workspace_id",workspace.id).eq("id",h.slot_id).maybeSingle();
 const slot=slotRes.data;
 if(slotRes.error||!slot||slot.id!==h.slot_id||
   slot.workspace_id!==workspace.id||!uuid(slot.crew_id)||
   typeof slot.starts_at!=="string"||!Number.isFinite(Date.parse(slot.starts_at))||
   Date.parse(slot.starts_at)<=now)return null;
 const crewRes=await service.from("crews")
  .select("id,workspace_id,branch_id,active")
  .eq("workspace_id",workspace.id).eq("id",slot.crew_id).maybeSingle();
 const crew=crewRes.data;
 if(crewRes.error||!crew||crew.id!==slot.crew_id||
   crew.workspace_id!==workspace.id||crew.branch_id!==req.branch_id)return null;

 // A visit or ANY payment application for this hold makes capacity release
 // unsafe, even when an application is described as declined or pending.
 const [visits,payments]=await Promise.all([
  service.from("visits").select("id")
   .eq("workspace_id",workspace.id).eq("quote_id",quoteId).limit(2),
  service.from("verified_payment_applications").select("id")
   .eq("workspace_id",workspace.id).eq("quote_id",quoteId).limit(2),
 ]);
 if(visits.error||payments.error||!rowsValid(visits.data,2)||
    !rowsValid(payments.data,2)||visits.data.length||payments.data.length)
    return null;
 return {branchId:req.branch_id,slotId:h.slot_id,expiresAt:h.expires_at,
  fingerprint:JSON.stringify([
   workspace.id,q.id,q.status,q.version,req.id,req.version,req.branch_id,
   h.id,h.status,h.expires_at,h.slot_id,slot.crew_id,slot.starts_at,
   crew.id,crew.branch_id,crew.active
  ])};
}
async function compareAndRelease(ctx:Actor,input:{holdId:string;quoteId:string;
 slotId:string;expiresAt:string;now:string}):Promise<boolean>{
 const {data,error}=await ctx.service.from("slot_holds")
  .update({status:"RELEASED",updated_at:input.now})
  .eq("workspace_id",ctx.workspace.id).eq("id",input.holdId)
  .eq("quote_id",input.quoteId).eq("slot_id",input.slotId)
  .eq("status","HELD").gt("expires_at",input.now)
  .select("id,workspace_id,quote_id,slot_id,status").maybeSingle();
 return !error&&data?.id===input.holdId&&data.workspace_id===ctx.workspace.id&&
   data.quote_id===input.quoteId&&data.slot_id===input.slotId&&
   data.status==="RELEASED";
}
/** A human owner releases exactly one current HELD capacity claim.
 * The feature is disabled by default. No payment, visit, provider, booking,
 * or automatic retry. Failed post-write proof MAY mean the release occurred.
 */
export async function releaseOwnerVerifiedQuoteHold(
 workspaceSlug:string,quoteId:string,holdId:string,deps:OwnerHoldReleaseDeps={},
):Promise<OwnerHoldReleaseResult>{
 if(!(deps.enabled??(()=>process.env.SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED==="true"))())
  return deny("NOT_ACTIVATED");
 if(!slug(workspaceSlug)||!uuid(quoteId)||!uuid(holdId)||quoteId===holdId)
  return deny("INVALID_SELECTION");
 if((deps.mode??operationalDatabaseMode)()!=="SERVICE_ROLE")
  return deny("OWNER_REQUIRED");
 const now=(deps.now??Date.now)();
 if(!Number.isFinite(now))return deny("SOURCE_UNAVAILABLE");
 const resolve=deps.resolve??resolveStaffActor;
 try{
  const first=await resolve(workspaceSlug);
  if(!approved(first,workspaceSlug))return deny("OWNER_REQUIRED");
  const one=await checkSource(first.value,quoteId,holdId,now);
  if(!one)return deny("HOLD_NOT_RELEASABLE");
  const second=await resolve(workspaceSlug);
  if(!approved(second,workspaceSlug)||second.value.actor.userId!==first.value.actor.userId||
     second.value.workspace.id!==first.value.workspace.id||
     !second.value.branchScope.branches.some(b=>b.id===one.branchId))
   return deny("SOURCE_CHANGED");
  const two=await checkSource(second.value,quoteId,holdId,now);
  if(!two||two.fingerprint!==one.fingerprint)return deny("SOURCE_CHANGED");
  const released=await (deps.release??compareAndRelease)(second.value,{
   holdId,quoteId,slotId:one.slotId,expiresAt:one.expiresAt,
   now:new Date(now).toISOString(),
  });
  if(!released)return deny("RELEASE_UNVERIFIED");
  const third=await resolve(workspaceSlug);
  if(!approved(third,workspaceSlug)||third.value.actor.userId!==first.value.actor.userId||
     third.value.workspace.id!==first.value.workspace.id||
     !third.value.branchScope.branches.some(b=>b.id===one.branchId))
   return deny("RELEASE_UNVERIFIED");
  const result=await third.value.service.from("slot_holds")
   .select("id,workspace_id,quote_id,slot_id,status")
   .eq("workspace_id",third.value.workspace.id).eq("id",holdId).maybeSingle();
  const h=result.data;
  if(result.error||!h||h.id!==holdId||h.workspace_id!==third.value.workspace.id||
     h.quote_id!==quoteId||h.slot_id!==one.slotId||h.status!=="RELEASED")
   return deny("RELEASE_UNVERIFIED");
  return {ok:true,state:"SAVED_HOLD_RELEASE_VERIFIED",holdId,quoteId,
   slotId:one.slotId,bookingCreated:false,paymentChanged:false,
   customerNotified:false,newCapacityUnverified:true};
 }catch{return deny("SOURCE_UNAVAILABLE");}
}
