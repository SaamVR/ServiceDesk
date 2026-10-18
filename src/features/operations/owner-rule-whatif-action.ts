"use server";

import { resolveStaffActor } from "./operational-product-runtime";
import { previewOwnerWorkflowWhatIf } from "@/server/ai/workflow-what-if-preview";
import type { SupportedOwnerRuleEvent } from "./owner-rule-browser-proof";

type Hypothesis = {workspaceSlug:string;branchId:string;candidate:unknown;
  sampleServiceCode:"NONE"|"STANDARD"|"DEEP"|"MOVE_OUT"};
export type OwnerWhatIfActionResult =
  | {ok:false;code:"OWNER_PREVIEW_UNAVAILABLE"}
  | {ok:true;state:"SYNTHETIC_RULE_PREVIEW_ONLY";
      inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT";
      eventType:SupportedOwnerRuleEvent; matched:boolean;conditionCount:number;
      checkedConditions:Array<{field:string;matched:boolean}>;
      wouldCreateAttention:boolean;executed:false;published:false;
      customerMessaged:false;paymentChanged:false;ownerPublishStillRequired:true};

const allowedId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Intentional, explicit server action. This is a synthetic evaluation only.
 * Rechecks workspace OWNER membership and saved branch authorization before
 * using the already-shipped production PREVIEW rule engine. No row is saved,
 * no provider is invoked, and no external action may run.
 */
export async function requestOwnerWorkflowWhatIf(input:Hypothesis):
  Promise<OwnerWhatIfActionResult> {
  const blocked=():OwnerWhatIfActionResult=>({ok:false,code:"OWNER_PREVIEW_UNAVAILABLE"});
  if(!input || typeof input.workspaceSlug!=="string" ||
     !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.workspaceSlug) ||
     input.workspaceSlug.length<3 || input.workspaceSlug.length>40 ||
     typeof input.branchId!=="string" || !allowedId.test(input.branchId) ||
     !["NONE","STANDARD","DEEP","MOVE_OUT"].includes(input.sampleServiceCode))
    return blocked();
  try {
    const auth=await resolveStaffActor(input.workspaceSlug);
    if(!auth.ok) return blocked();
    const {actor,workspace,service}=auth.value;
    if(workspace.slug!==input.workspaceSlug || actor.role!=="OWNER" ||
       actor.workspaceId!==workspace.id || !allowedId.test(workspace.id) ||
       typeof actor.userId!=="string" || !allowedId.test(actor.userId)) return blocked();
    const branch=await service.from("branches")
      .select("id,workspace_id").eq("id",input.branchId)
      .eq("workspace_id",workspace.id).maybeSingle();
    if(branch.error || !branch.data || branch.data.id!==input.branchId ||
       branch.data.workspace_id!==workspace.id) return blocked();
    const result=previewOwnerWorkflowWhatIf(input.candidate,{
      workspaceId:workspace.id,actorWorkspaceId:workspace.id,
      branchId:input.branchId,role:"OWNER",
    },input.sampleServiceCode==="NONE"?{}:{
      serviceCode:input.sampleServiceCode,
    });
    if(!result.ok) return blocked();
    const value=result.value;
    // Explicitly project safe hypothetical fields only, never raw model
    // prompt, knowledge, contact, customer or workflow source identity.
    return {
      ok:true,state:value.state,inputSource:value.inputSource,
      eventType:value.eventType,matched:value.matched,
      conditionCount:value.conditionCount,
      checkedConditions:value.checkedConditions.map(d=>({
        field:d.field,matched:d.matched,
      })),
      wouldCreateAttention:value.wouldCreateAttention,
      executed:false,published:false,customerMessaged:false,
      paymentChanged:false,ownerPublishStillRequired:true,
    };
  }catch{return blocked();}
}
