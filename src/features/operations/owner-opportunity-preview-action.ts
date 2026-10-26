"use server";
import {suggestOwnerAutomationOpportunities} from "@/server/ai/owner-automation-opportunities";

/** Real signed-in owner workday + active saved workspace_branches boundary.
 * Returns strictly bounded internal attention draft previews, never saves one. */
export type OwnerOpportunityActionResult=
 | {ok:false;state:"OWNER_OPPORTUNITY_UNAVAILABLE"}
 | {ok:true;state:"OWNER_OPPORTUNITY_REVIEW_ONLY";
    source:"DOUBLE_CHECKED_OWNER_WORKDAY_AND_ACTIVE_WORKSPACE_BRANCH";
    workspaceId:string;branchId:string;inspectedPriorities:number;
    suggestions:Array<{
      evidenceKey:"CRITICAL_ATTENTION"|"OPEN_REQUEST";
      savedCount:number;
      target:"FUTURE_ATTENTION_OPENED"|"FUTURE_REQUEST_CREATED";
      eventType:"ATTENTION_OPENED"|"REQUEST_CREATED";
      severity:"CRITICAL"|"WARNING";
      summaryKey:"AI_TRIAGE_EXCEPTION"|"AI_REVIEW_NEW_REQUEST";
      existingCasesProcessed:false;published:false;requiresOwnerApproval:true;
    }>;
    modelInvoked:false;saved:false;executed:false;published:false;
    providerMessagesSent:false;financialStateChanged:false};
const denied=():OwnerOpportunityActionResult=>({ok:false,state:"OWNER_OPPORTUNITY_UNAVAILABLE"});
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function own(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 try{
  if(!value||typeof value!=="object"||Array.isArray(value)||
     Object.getPrototypeOf(value)!==Object.prototype)return false;
  const names=Reflect.ownKeys(value);
  const desc=Object.getOwnPropertyDescriptors(value);
  return names.length===keys.length&&names.every(k=>typeof k==="string"&&keys.includes(k))&&
   keys.every(k=>Object.hasOwn(desc,k)&&Object.hasOwn(desc[k],"value")&&desc[k].enumerable);
 }catch{return false;}
}
/** Explicit owner request only. The existing engine re-resolves owner authority
 * twice and independently rechecks the saved active branch each time. */
export async function requestOwnerOpportunityPreview(input:unknown):Promise<OwnerOpportunityActionResult>{
 if(!own(input,["workspaceSlug","branchId"])||
    typeof input.workspaceSlug!=="string"||input.workspaceSlug.length<3||
    input.workspaceSlug.length>40||!slug.test(input.workspaceSlug)||
    typeof input.branchId!=="string"||!uuid.test(input.branchId))return denied();
 try{
  const branchId=input.branchId,workspaceSlug=input.workspaceSlug;
  const result=await suggestOwnerAutomationOpportunities(workspaceSlug,branchId,{
   verifyBranch:async(service,workspaceId,selectedBranchId)=>{
    // workspace_branches, not the legacy generic "branches" table.
    const read=await service.from("workspace_branches").select("id,workspace_id,active")
     .eq("id",selectedBranchId).eq("workspace_id",workspaceId)
     .eq("active",true).maybeSingle();
    return !read.error&&read.data?.id===selectedBranchId&&
     read.data?.workspace_id===workspaceId&&read.data?.active===true;
   },
  });
  if(!result.ok)return denied();
  const v=result.value;
  if(v.state!=="OWNER_SAVED_SIGNALS_FUTURE_RULE_DRAFTS_ONLY"||
     v.source!=="DOUBLE_CHECKED_OWNER_WORKDAY_AND_SAVED_BRANCH"||
     !uuid.test(v.workspaceId)||v.branchId!==branchId||
     !Number.isSafeInteger(v.inspectedPriorities)||v.inspectedPriorities<0||
     v.inspectedPriorities>7||!Array.isArray(v.suggestions)||
     v.suggestions.length>2||v.modelInvoked!==false||
     v.published!==false||v.providerMessagesSent!==false||
     v.financialStateChanged!==false)return denied();
  const seen=new Set<string>();
  const suggestions:Extract<OwnerOpportunityActionResult,{ok:true}>["suggestions"]=[];
  for(const item of v.suggestions){
   if(!item||!own(item,["evidenceKey","savedCount","target","draft","existingCasesProcessed","published","requiresOwnerApproval"])||
      !own(item.draft,["state","source","workspaceId","branchId","eventType","conditions","actions","maxActionsPerEvent","published","requiresOwnerPublish","previewOnly","sendsCustomerMessages","mutatesFinancialState"])||
      !Array.isArray(item.draft.conditions)||item.draft.conditions.length!==0||
      !Array.isArray(item.draft.actions)||item.draft.actions.length!==1||
      !own(item.draft.actions[0],["type","severity","summaryKey"])||
      item.draft.actions[0].type!=="CREATE_ATTENTION"||
      item.draft.state!=="DRAFT_REQUIRES_OWNER_REVIEW"||
      item.draft.workspaceId!==v.workspaceId||item.draft.branchId!==branchId||
      item.draft.source!=="UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED"||
      item.draft.maxActionsPerEvent!==1||item.draft.published!==false||
      item.draft.requiresOwnerPublish!==true||item.draft.previewOnly!==true||
      item.draft.sendsCustomerMessages!==false||item.draft.mutatesFinancialState!==false||
      item.existingCasesProcessed!==false||item.published!==false||
      item.requiresOwnerApproval!==true||!Number.isSafeInteger(item.savedCount)||
      item.savedCount<1||item.savedCount>5000||seen.has(item.evidenceKey))return denied();
   seen.add(item.evidenceKey);
   const critical=item.evidenceKey==="CRITICAL_ATTENTION";
   if(!critical&&item.evidenceKey!=="OPEN_REQUEST")return denied();
   if(item.target!==(critical?"FUTURE_ATTENTION_OPENED":"FUTURE_REQUEST_CREATED")||
      item.draft.eventType!==(critical?"ATTENTION_OPENED":"REQUEST_CREATED")||
      item.draft.actions[0].severity!==(critical?"CRITICAL":"WARNING")||
      item.draft.actions[0].summaryKey!==(critical?"AI_TRIAGE_EXCEPTION":"AI_REVIEW_NEW_REQUEST"))
     return denied();
   suggestions.push({
    evidenceKey:critical?"CRITICAL_ATTENTION":"OPEN_REQUEST",savedCount:item.savedCount,
    target:critical?"FUTURE_ATTENTION_OPENED":"FUTURE_REQUEST_CREATED",
    eventType:critical?"ATTENTION_OPENED":"REQUEST_CREATED",
    severity:critical?"CRITICAL":"WARNING",
    summaryKey:critical?"AI_TRIAGE_EXCEPTION":"AI_REVIEW_NEW_REQUEST",
    existingCasesProcessed:false,published:false,requiresOwnerApproval:true,
   });
  }
  return {ok:true,state:"OWNER_OPPORTUNITY_REVIEW_ONLY",
   source:"DOUBLE_CHECKED_OWNER_WORKDAY_AND_ACTIVE_WORKSPACE_BRANCH",
   workspaceId:v.workspaceId,branchId,inspectedPriorities:v.inspectedPriorities,
   suggestions,modelInvoked:false,saved:false,executed:false,published:false,
   providerMessagesSent:false,financialStateChanged:false};
 }catch{return denied();}
}
