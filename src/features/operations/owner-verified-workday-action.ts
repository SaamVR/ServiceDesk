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
// This is a closed view-model projection, not a reflection of upstream data.
// A forged source row must not export arbitrary key, priority or destination
// values under an owner-verified source label.
const expectedPriority:Record<OwnerPriorityAction["key"],{
 module:OwnerPriorityAction["module"];priority:OwnerPriorityAction["priority"];
}> = {
 CRITICAL_ATTENTION:{module:"overview",priority:"CRITICAL"},
 LEDGER_REVIEW:{module:"invoices",priority:"HIGH"},
 QUOTE_VALIDITY:{module:"quotes",priority:"HIGH"},
 UNASSIGNED_VISIT:{module:"schedule",priority:"HIGH"},
 COLLECTIBLE_INVOICE:{module:"invoices",priority:"NORMAL"},
 WAITING_QUOTE:{module:"quotes",priority:"NORMAL"},
 OPEN_REQUEST:{module:"requests",priority:"NORMAL"},
};

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
  // Validate the *whole* returned owner priority list before projecting
  // the first five entries. A poisoned sixth or seventh row must not disappear.
  const verified=result.value.priorities;
  const seen=new Set<string>();
  if(verified.some(item=>{
    if(!item || typeof item.key!=="string" ||
       !Object.hasOwn(expectedPriority,item.key) || seen.has(item.key) ||
       item.source!=="VERIFIED_SAVED_QUEUE_COUNT" ||
       !Number.isSafeInteger(item.count) || item.count<1 || item.count>5000)
      return true;
    seen.add(item.key);
    const expected=expectedPriority[item.key];
    return !expected || item.module!==expected.module ||
      item.priority!==expected.priority;
  }))return denied();
  const priorityItems=verified.slice(0,5);
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
