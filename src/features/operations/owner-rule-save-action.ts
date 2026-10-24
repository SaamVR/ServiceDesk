"use server";

import {resolveStaffActor,saveOperationalWorkflowDraft} from "./operational-product-runtime";
import {compileModelWorkflowDraft} from "@/server/ai/workflow-draft-proposal";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
import type {SupportedOwnerRuleEvent,SuggestedSeverity,SuggestedServiceCode} from "./owner-rule-browser-proof";

type Candidate={eventType:SupportedOwnerRuleEvent;severity:SuggestedSeverity;serviceCode?:SuggestedServiceCode};
type SaveInput={workspaceSlug:string;branchId:string;candidate:Candidate;code:string;name:string};
export type ReviewedDraftSaveResult=
 | {ok:false;state:"DRAFT_NOT_SAVED"}
 | {ok:true;state:"DRAFT_SAVED_OWNER_PREVIEW_REQUIRED";published:false;executed:false;customerMessaged:false;paymentChanged:false};

const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern=/^[A-Z0-9][A-Z0-9_-]{2,63}$/;

/** Explicit owner confirmation only. The model cannot invoke this from its
 * output. Reauthorize the session + saved branch, recompile from fixed
 * catalog, and delegate durable writes to existing owner-only source RPC.
 * No publish, provider send, billing, or event execution is performed.
 */
export async function saveOwnerReviewedWorkflowDraft(input:SaveInput):Promise<ReviewedDraftSaveResult>{
 const blocked=():ReviewedDraftSaveResult=>({ok:false,state:"DRAFT_NOT_SAVED"});
 if(!input||typeof input.workspaceSlug!=="string"||
    input.workspaceSlug.length<3||input.workspaceSlug.length>40||
    !slug.test(input.workspaceSlug)||typeof input.branchId!=="string"||
    !uuid.test(input.branchId)||typeof input.code!=="string"||
    !codePattern.test(input.code)||typeof input.name!=="string"||
    input.name.trim().length<5||input.name.length>120||
    /[\u0000-\u001f\u007f]/u.test(input.name)||
    !input.candidate||typeof input.candidate!=="object"||
    Array.isArray(input.candidate)||operationalDatabaseMode()!=="SERVICE_ROLE")
   return blocked();
 try{
   const verified=await resolveStaffActor(input.workspaceSlug);
   if(!verified.ok)return blocked();
   const {actor,workspace,branchScope}=verified.value;
   if(actor.role!=="OWNER"||workspace.slug!==input.workspaceSlug||
      actor.workspaceId!==workspace.id||
      !branchScope.branches.some(b=>b.id===input.branchId)||
      (branchScope.mode==="BRANCH"&&branchScope.selectedBranchId!==input.branchId))
     return blocked();
   const compiled=compileModelWorkflowDraft(input.candidate,{
     workspaceId:workspace.id,actorWorkspaceId:actor.workspaceId,
     branchId:input.branchId,role:"OWNER",
   });
   if(!compiled.ok||compiled.value.actions.length!==1||
      compiled.value.actions[0]?.type!=="CREATE_ATTENTION"||
      compiled.value.sendsCustomerMessages!==false||
      compiled.value.mutatesFinancialState!==false)return blocked();
   // The authoritative writer repeats owner + branch authorization on write.
   const saved=await saveOperationalWorkflowDraft(input.workspaceSlug,{
     branchId:input.branchId,code:input.code,name:input.name.trim(),
     eventType:compiled.value.eventType,
     conditions:compiled.value.conditions.map(c=>({
       field:c.field,operator:c.operator,value:c.value,
     })),
     actions:compiled.value.actions.map(a=>({...a})),maxActionsPerEvent:1,
   });
   if(!saved.ok)return blocked();
   return {ok:true,state:"DRAFT_SAVED_OWNER_PREVIEW_REQUIRED",
     published:false,executed:false,customerMessaged:false,paymentChanged:false};
 }catch{return blocked();}
}
