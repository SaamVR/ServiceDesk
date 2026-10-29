import type { OwnerAttentionSlaResult } from "@/server/ai/owner-attention-sla";
import { trustedQuoteInstant } from "./quote-validity-clock";

export type OwnerAttentionReviewProjection =
 | { ok:false; state:"ATTENTION_EVIDENCE_UNAVAILABLE" }
 | { ok:true; state:"SAVED_OWNER_ATTENTION_REVIEW_ONLY";
     source:"DOUBLE_CHECKED_SAVED_ATTENTION_ROWS";
     inspected:number; overdueCount:number; unscheduledCount:number;
     omittedCount:number; visible:Array<{severity:"CRITICAL"|"WARNING"|"INFO";
        status:"OPEN"|"ACKNOWLEDGED"; dueAt:string; overdueMinutes:number}>;
     ownerReviewRequired:true; modelInvoked:false; workflowExecuted:false;
     providerDeliveryVerified:false; customerMessaged:false; moneyChanged:false };

const denied=():OwnerAttentionReviewProjection=>({ok:false,state:"ATTENTION_EVIDENCE_UNAVAILABLE"});
const int=(v:unknown)=>Number.isSafeInteger(v) && (v as number)>=0 && (v as number)<=4999;
const minutes=(v:unknown)=>Number.isSafeInteger(v) && (v as number)>=0 && (v as number)<52560000;
function safeRecord(value:unknown,required:readonly string[]):value is Record<string,unknown>{
 try{
  if(!value||typeof value!=="object"||Array.isArray(value)||
     Object.getPrototypeOf(value)!==Object.prototype)return false;
  const props=Object.getOwnPropertyDescriptors(value);
  return required.every(key=>Object.hasOwn(props,key) &&
    Object.hasOwn(props[key],"value") && props[key].enumerable===true);
 }catch{return false;}
}
/**
 * Owner UI receives a tiny immutable-data allowlist from the double-checked,
 * authenticated server source. Attention resource IDs, free-text summaries,
 * contact data, workflow input and provider payloads are never returned.
 */
export function projectOwnerAttentionReview(
  result: OwnerAttentionSlaResult,
):OwnerAttentionReviewProjection {
 try{
  if(!safeRecord(result,["ok"])||result.ok!==true||
     !safeRecord(result.value,["state","source","inspected","overdueCount",
       "unscheduledCount","overdue","ownerReviewRequired","modelInvoked",
       "customerMessaged","workflowExecuted"]) ||
     result.value.state!=="SAVED_ATTENTION_SLA_OWNER_REVIEW" ||
     result.value.source!=="DOUBLE_CHECKED_SAVED_ATTENTION_ROWS" ||
     result.value.ownerReviewRequired!==true || result.value.modelInvoked!==false ||
     result.value.customerMessaged!==false || result.value.workflowExecuted!==false ||
     !int(result.value.inspected)||!int(result.value.overdueCount)||
     !int(result.value.unscheduledCount)||!Array.isArray(result.value.overdue)||
     result.value.overdue.length!==result.value.overdueCount ||
     result.value.overdueCount+result.value.unscheduledCount>result.value.inspected)
      return denied();
  const alerts=result.value.overdue;
  if(Reflect.ownKeys(alerts).length!==alerts.length+1)return denied();
  const seen=new Set<string>();
  const projected:Extract<OwnerAttentionReviewProjection,{ok:true}>["visible"]=[];
  for(let i=0;i<alerts.length;i++){
    const descriptor=Object.getOwnPropertyDescriptor(alerts,String(i));
    if(!descriptor||!Object.hasOwn(descriptor,"value")||descriptor.enumerable!==true)
      return denied();
    const a=descriptor.value;
    if(!safeRecord(a,["attentionId","severity","status","dueAt","overdueMinutes","ownerReviewRequired"])||
       typeof a.attentionId!=="string" || a.attentionId.length<3 ||
       a.attentionId.length>128 || seen.has(a.attentionId) ||
       !["CRITICAL","WARNING","INFO"].includes(a.severity as string) ||
       !["OPEN","ACKNOWLEDGED"].includes(a.status as string) ||
       a.ownerReviewRequired!==true || trustedQuoteInstant(a.dueAt)===null ||
       !minutes(a.overdueMinutes)) return denied();
    seen.add(a.attentionId);
    if(projected.length<6){
      projected.push({severity:a.severity as "CRITICAL"|"WARNING"|"INFO",
        status:a.status as "OPEN"|"ACKNOWLEDGED",
        dueAt:a.dueAt as string,overdueMinutes:a.overdueMinutes as number});
    }
  }
  return {ok:true,state:"SAVED_OWNER_ATTENTION_REVIEW_ONLY",
    source:"DOUBLE_CHECKED_SAVED_ATTENTION_ROWS",
    inspected:result.value.inspected,overdueCount:result.value.overdueCount,
    unscheduledCount:result.value.unscheduledCount,
    omittedCount:alerts.length-projected.length,visible:projected,
    ownerReviewRequired:true,modelInvoked:false,workflowExecuted:false,
    providerDeliveryVerified:false,customerMessaged:false,moneyChanged:false};
 }catch{return denied();}
}
