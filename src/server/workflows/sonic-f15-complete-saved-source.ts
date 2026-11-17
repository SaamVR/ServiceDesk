import type {SupabaseClient} from "@supabase/supabase-js";
import type {F15SavedLeadFacts} from "./sonic-f15-unanswered-lead-sla";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const valid=(v:unknown):v is string=>typeof v==="string"&&uuid.test(v);
const date=(v:unknown):v is string=>typeof v==="string"&&Number.isFinite(Date.parse(v));
const array=(v:unknown,max:number):v is Record<string,unknown>[]=>
  Array.isArray(v)&&v.length<max&&v.every(x=>x!==null&&typeof x==="object"&&!Array.isArray(x));
/**
 * Server-only collection of WHOLE current saved message history for one
 * request. Never infer "unanswered" from a truncated Inbox/UI snapshot.
 *
 * The persisted F15 SQL transaction independently rechecks all of these
 * facts under a request lock immediately before insertion. This read alone
 * cannot be interpreted as durable proof or authorization for a message.
 */
export async function readF15CompleteSavedLeadFacts(
 service:Pick<SupabaseClient,"from">, workspaceId:string,branchId:string,requestId:string,
):Promise<F15SavedLeadFacts|null>{
 if(!valid(workspaceId)||!valid(branchId)||!valid(requestId)||
    new Set([workspaceId,branchId,requestId]).size!==3)return null;
 try{
  const req=await service.from("requests")
   .select("id,workspace_id,branch_id,version,status,created_at,customer_id")
   .eq("workspace_id",workspaceId).eq("branch_id",branchId)
   .eq("id",requestId).maybeSingle();
  const x=req.data;
  if(req.error||!x||x.id!==requestId||x.workspace_id!==workspaceId||
     x.branch_id!==branchId||!Number.isSafeInteger(x.version)||
     x.version<1||x.version>2147483647||
     !["NEW","COLLECTING","NEEDS_REVIEW"].includes(x.status)||
     !date(x.created_at)||(x.customer_id!==null&&!valid(x.customer_id)))return null;

  const conv=await service.from("conversations")
   .select("id,workspace_id,branch_id,request_id,customer_id")
   .eq("workspace_id",workspaceId).eq("request_id",requestId).limit(2);
  if(conv.error||!array(conv.data,2)||conv.data.length!==1)return null;
  const c=conv.data[0];
  if(!valid(c.id)||c.workspace_id!==workspaceId||
     c.branch_id!==branchId||c.request_id!==requestId||
     c.customer_id!==x.customer_id)return null;

  // A reply in another linked conversation for the same customer makes
  // an apparent unanswered request ambiguous. Refuse until reconciled.
  if(valid(x.customer_id)){
   const siblings=await service.from("conversations")
    .select("id,workspace_id,branch_id,request_id,customer_id")
    .eq("workspace_id",workspaceId).eq("customer_id",x.customer_id).limit(201);
   if(siblings.error||!array(siblings.data,201)||siblings.data.length!==1||
      siblings.data[0].id!==c.id||
      siblings.data[0].branch_id!==branchId)return null;
  }
  const messages=await service.from("messages")
   .select("id,workspace_id,conversation_id,direction,sender_kind,created_at")
   .eq("workspace_id",workspaceId).eq("conversation_id",c.id).limit(201);
  if(messages.error||!array(messages.data,201))return null;
  const ids=new Set<string>();
  let lastInbound:{id:string;at:string}|null=null, lastStaff:string|null=null;
  for(const m of messages.data){
   if(!valid(m.id)||ids.has(m.id)||m.workspace_id!==workspaceId||
      m.conversation_id!==c.id||!date(m.created_at)||
      !["INBOUND","OUTBOUND","INTERNAL"].includes(m.direction)||
      !["CUSTOMER","STAFF","AI","SYSTEM"].includes(m.sender_kind))return null;
   ids.add(m.id);
   if(m.direction==="INBOUND"&&m.sender_kind==="CUSTOMER"&&
       (!lastInbound||Date.parse(m.created_at)>Date.parse(lastInbound.at)||
        (Date.parse(m.created_at)===Date.parse(lastInbound.at)&&m.id>lastInbound.id)))
     lastInbound={id:m.id,at:m.created_at};
   if(m.direction==="OUTBOUND"&&m.sender_kind==="STAFF"&&
       (lastStaff===null||Date.parse(m.created_at)>Date.parse(lastStaff)))
     lastStaff=m.created_at;
  }
  if(!lastInbound)return null;
  return {
   workspaceId,branchId,requestId,version:x.version,status:x.status,
   createdAt:x.created_at,lastInboundAt:lastInbound.at,
   lastInboundMessageId:lastInbound.id,lastStaffResponseAt:lastStaff,
   responseHistoryComplete:true,
  };
 }catch{return null;}
}
