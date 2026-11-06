import type {resolveStaffActor} from "@/features/operations/operational-product-runtime";
type Actor=Extract<Awaited<ReturnType<typeof resolveStaffActor>>,{ok:true}>["value"];
const uuid=(v:unknown):v is string=>typeof v==="string"&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const safeRows=(rows:unknown,max:number):rows is Array<Record<string,unknown>>=>
 Array.isArray(rows)&&rows.length<max&&rows.every(r=>r!==null&&typeof r==="object"&&!Array.isArray(r));
export type DispatchCrewProof={workspaceId:string;branchId:string;
 quoteId:string;visitId:string;crewId:string;slotId:string;
 visitVersion:number;activeMemberCount:number;fingerprint:string};

/**
 * F26 dispatch-only readiness. A historical paid booking remains historically
 * valid when a crew becomes inactive; dispatching it again does not.
 * This query is NOT a substitute for an atomic crew-active check inside the
 * actual ASSIGN transaction (0011 currently checks crew_id only).
 */
export async function readActiveBookedVisitCrew(
 actor:Actor,quoteId:string,visitId:string,
):Promise<DispatchCrewProof|null>{
 if(!uuid(actor.workspace.id)||!uuid(quoteId)||!uuid(visitId)||
    actor.branchScope.mode!=="ALL")return null;
 const ws=actor.workspace.id, db=actor.service;
 try{
  const vr=await db.from("visits")
   .select("id,workspace_id,quote_id,request_id,crew_id,slot_id,status,version")
   .eq("workspace_id",ws).eq("quote_id",quoteId).eq("id",visitId).maybeSingle();
  const v=vr.data;
  if(vr.error||!v||v.id!==visitId||v.workspace_id!==ws||
     v.quote_id!==quoteId||v.status!=="SCHEDULED"||
     !uuid(v.request_id)||!uuid(v.crew_id)||!uuid(v.slot_id)||
     !Number.isSafeInteger(v.version)||v.version<1)return null;
  const req=await db.from("requests")
   .select("id,workspace_id,branch_id")
   .eq("workspace_id",ws).eq("id",v.request_id).maybeSingle();
  if(req.error||req.data?.id!==v.request_id||
     req.data?.workspace_id!==ws||!uuid(req.data?.branch_id)||
     !actor.branchScope.branches.some(b=>b.id===req.data?.branch_id))
   return null;
  const branchId=req.data.branch_id as string;
  const slot=await db.from("capacity_slots")
   .select("id,workspace_id,crew_id")
   .eq("workspace_id",ws).eq("id",v.slot_id).maybeSingle();
  if(slot.error||slot.data?.id!==v.slot_id||slot.data?.workspace_id!==ws||
     slot.data?.crew_id!==v.crew_id)return null;
  const crew=await db.from("crews")
   .select("id,workspace_id,branch_id,active")
   .eq("workspace_id",ws).eq("id",v.crew_id).maybeSingle();
  if(crew.error||crew.data?.id!==v.crew_id||
     crew.data?.workspace_id!==ws||crew.data?.branch_id!==branchId||
     crew.data?.active!==true)return null;
  const members=await db.from("crew_members")
   .select("id,workspace_id,crew_id,user_id,active")
   .eq("workspace_id",ws).eq("crew_id",v.crew_id)
   .eq("active",true).limit(51);
  if(members.error||!safeRows(members.data,51)||members.data.length===0)return null;
  const ids=new Set<string>();
  for(const member of members.data){
   if(!uuid(member.id)||member.workspace_id!==ws||
      member.crew_id!==v.crew_id||!uuid(member.user_id)||
      member.active!==true||ids.has(member.user_id))return null;
   ids.add(member.user_id);
  }
  const memberships=await db.from("memberships")
   .select("user_id,workspace_id,role,status")
   .eq("workspace_id",ws).eq("status","ACTIVE").eq("role","CREW")
   .in("user_id",Array.from(ids)).limit(51);
  if(memberships.error||!safeRows(memberships.data,51))return null;
  const live=new Set<string>();
  for(const row of memberships.data){
   if(!uuid(row.user_id)||!ids.has(row.user_id)||live.has(row.user_id)||
      row.workspace_id!==ws||row.status!=="ACTIVE"||
      row.role!=="CREW")
     return null;
   live.add(row.user_id);
  }
  if(live.size===0)return null;
  const ordered=Array.from(live).sort();
  return {workspaceId:ws,branchId,quoteId,visitId,crewId:v.crew_id,
   slotId:v.slot_id,visitVersion:v.version,activeMemberCount:live.size,
   fingerprint:JSON.stringify([ws,branchId,quoteId,visitId,v.version,
    v.crew_id,v.slot_id,crew.data.active,ordered])};
 }catch{return null;}
}
