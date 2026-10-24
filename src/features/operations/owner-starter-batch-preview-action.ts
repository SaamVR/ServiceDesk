"use server";

import { prepareAuthorizedAutomationStarterBatch } from "@/server/ai/owner-starter-batch";
import type { WorkflowEventType } from "@/contracts";

/** A safe owner-read preview, not a model call or workflow installation. */
export type OwnerStarterPreview = {
  starterId: string; code: string; eventType: WorkflowEventType;
  conditions: Array<{field:string;operator:"EQ"|"NEQ"|"IN";value:unknown}>;
  actions: Array<{type:"CREATE_ATTENTION";severity:"INFO"|"WARNING"|"CRITICAL";
    summaryKey:string}>;
  persisted:false;published:false;executed:false;
};
export type OwnerStarterBatchPreview =
  | {ok:false;state:"OWNER_STARTER_PREVIEW_UNAVAILABLE"}
  | {ok:true;state:"OWNER_STARTER_BATCH_PREVIEW_ONLY";
     workspaceId:string;branchId:string;
     drafts:OwnerStarterPreview[];selectedCount:number;
     ownerReviewRequired:true;persisted:false;published:false;
     executed:false;paidModelInvoked:false;providerMessagesSent:false;
     paymentChanged:false};

const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const blocked=():OwnerStarterBatchPreview=>({ok:false,state:"OWNER_STARTER_PREVIEW_UNAVAILABLE"});

/**
 * Explicit server action. The default backend independently reauthorizes
 * an active saved workspace_branches row twice and all OWNER membership.
 * Output is reconstructed from the fixed internal-action catalogue only.
 */
export async function previewOwnerAutomationStarters(input:{
 workspaceSlug:string;branchId:string;starterIds:string[];
}):Promise<OwnerStarterBatchPreview>{
 if(!input || typeof input!=="object" || Array.isArray(input) ||
    typeof input.workspaceSlug!=="string" ||
    input.workspaceSlug.length<3 || input.workspaceSlug.length>40 ||
    !slug.test(input.workspaceSlug) ||
    typeof input.branchId!=="string" || !uuid.test(input.branchId))
  return blocked();
 try{
  const response=await prepareAuthorizedAutomationStarterBatch(
    input.workspaceSlug,input.branchId,input.starterIds);
  if(!response.ok || response.value.persisted!==false ||
     response.value.published!==false || response.value.executed!==false ||
     response.value.providerMessagesSent!==false ||
     response.value.paymentChanged!==false ||
     response.value.modelInvoked!==false ||
     response.value.drafts.length<1 || response.value.drafts.length>12 ||
     response.value.selectedCount!==response.value.drafts.length ||
     response.value.branchId!==input.branchId)
    return blocked();
  const drafts:OwnerStarterPreview[]=[];
  for(const draft of response.value.drafts){
   if(draft.persisted!==false || draft.published!==false ||
      draft.providerMessagesSent!==false || draft.paymentChanged!==false ||
      draft.actions.length!==1 || draft.actions[0]?.type!=="CREATE_ATTENTION")
     return blocked();
   const action=draft.actions[0];
   if(!action || !["INFO","WARNING","CRITICAL"].includes(String(action.severity)) ||
      typeof action.summaryKey!=="string" ||
      !/^[A-Z0-9_]{3,80}$/.test(action.summaryKey))
     return blocked();
   drafts.push({
    starterId:draft.starterId,code:draft.code,eventType:draft.eventType,
    conditions:draft.conditions.map(c=>({
      field:c.field,operator:c.operator,value:c.value,
    })),
    actions:[{type:"CREATE_ATTENTION",
      severity:action.severity as "INFO"|"WARNING"|"CRITICAL",
      summaryKey:action.summaryKey}],
    persisted:false,published:false,executed:false,
   });
  }
  return {
   ok:true,state:"OWNER_STARTER_BATCH_PREVIEW_ONLY",
   workspaceId:response.value.workspaceId,branchId:response.value.branchId,
   drafts,selectedCount:drafts.length,ownerReviewRequired:true,
   persisted:false,published:false,executed:false,paidModelInvoked:false,
   providerMessagesSent:false,paymentChanged:false,
  };
 }catch{return blocked();}
}
