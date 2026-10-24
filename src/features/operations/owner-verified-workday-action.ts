"use server";

import {loadOwnerWorkdayPriorities} from "@/server/ai/owner-workday-priorities";
import type {OwnerPriorityAction} from "@/server/ai/owner-priority-actions";

export type OwnerVerifiedWorkdayAction=
 | {ok:false;state:"SAVED_WORKDAY_UNAVAILABLE"}
 | {ok:true;state:"SAVED_WORKDAY_REVIEW_ONLY";
    source:"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS";
    priorities:Array<Pick<OwnerPriorityAction,"key"|"count"|"module"|"priority"|"source">>;
    overdueCount:number;unscheduledCount:number;
    manualReviewRequired:true;modelInvoked:false;
    workflowExecuted:false;customerMessaged:false;paymentChanged:false};

const denied=():OwnerVerifiedWorkdayAction=>({ok:false,state:"SAVED_WORKDAY_UNAVAILABLE"});
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Explicit owner-only read. Two authoritative saved workspace snapshots are
 * checked inside the model-free workday engine. Expose only bounded queue
 * counts and fixed allowlisted navigation labels; no IDs, PII or prompts.
 */
export async function requestOwnerVerifiedWorkdayReview(
 workspaceSlug:string,
):Promise<OwnerVerifiedWorkdayAction>{
 if(typeof workspaceSlug!=="string" || workspaceSlug.length<3 ||
    workspaceSlug.length>40 || !slug.test(workspaceSlug))return denied();
 try{
  const result=await loadOwnerWorkdayPriorities(workspaceSlug);
  if(!result.ok || result.value.state!=="VERIFIED_OWNER_WORKDAY_REVIEW" ||
     result.value.source!=="DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS" ||
     result.value.manualReviewRequired!==true ||
     result.value.modelInvoked!==false ||
     result.value.providerMessageSent!==false ||
     result.value.paymentChanged!==false ||
     result.value.attentionSla.state!=="SAVED_ATTENTION_SLA_OWNER_REVIEW" ||
     result.value.attentionSla.workflowExecuted!==false ||
     result.value.attentionSla.customerMessaged!==false ||
     !Array.isArray(result.value.priorities) ||
     result.value.priorities.length>7)return denied();
  const counts=[result.value.attentionSla.overdueCount,
    result.value.attentionSla.unscheduledCount];
  if(counts.some(v=>!Number.isSafeInteger(v)||v<0||v>5000))return denied();
  const priorityItems=result.value.priorities.slice(0,5);
  if(priorityItems.some(item=>
    item.source!=="VERIFIED_SAVED_QUEUE_COUNT" ||
    !Number.isSafeInteger(item.count) || item.count<1||item.count>5000 ||
    !["overview","requests","quotes","schedule","invoices"].includes(item.module)
  ))return denied();
  return {
   ok:true,state:"SAVED_WORKDAY_REVIEW_ONLY",
   source:"DOUBLE_CHECKED_SAVED_WORKSPACE_COUNTS",
   priorities:priorityItems.map(item=>({
     key:item.key,count:item.count,module:item.module,
     priority:item.priority,source:"VERIFIED_SAVED_QUEUE_COUNT",
   })),
   overdueCount:counts[0],unscheduledCount:counts[1],
   manualReviewRequired:true,modelInvoked:false,
   workflowExecuted:false,customerMessaged:false,paymentChanged:false,
  };
 }catch{return denied();}
}
