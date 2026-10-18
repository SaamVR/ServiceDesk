import type {WorkflowRuleVersionDTO} from "../../contracts";
import type {ProposedOwnerWorkflowDraft} from "./workflow-draft-proposal";

export interface SavedRuleInventoryInput{
  actor:{workspaceId:string;role:string};
  workspaceId:string;branchId:string;
  inventorySource:"SAVED_PUBLISHED_RULE_VERSIONS";
  currentPublished:readonly WorkflowRuleVersionDTO[];
  proposed:readonly ProposedOwnerWorkflowDraft[];
}
type Overlap="CERTAIN_SAME_EVENT_UNCONDITIONAL"|"CERTAIN_SAME_SERVICE_FILTER"|"POSSIBLE_CONDITION_OVERLAP";
export type SavedRuleOverlapResult=
 | {ok:false;code:"RULE_INVENTORY_OWNER_REQUIRED"|"RULE_INVENTORY_UNVERIFIED"}
 | {ok:true;value:{
   state:"OWNER_PUBLISHED_RULE_OVERLAP_REVIEW";
   source:"SAVED_PUBLISHED_RULE_VERSIONS";
   inspectedPublished:number;inspectedProposed:number;overlapCount:number;
   overlaps:Array<{publishedRuleId:string;versionNumber:number;draftIndex:number;
     eventType:WorkflowRuleVersionDTO["eventType"];kind:Overlap}>;
   noOverlapsInSuppliedInventory:boolean;completeInventoryNotProven:true;
   ownerReviewRequired:true;published:false;executed:false;
   providerMessageSent:false;paymentChanged:false;}};

const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{3,128}$/.test(v);
const events=new Set(["REQUEST_CREATED","QUOTE_ACCEPTED","VISIT_COMPLETED","INVOICE_PAID","ATTENTION_OPENED"]);
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&
  Object.getPrototypeOf(v)===Object.prototype&&
  Reflect.ownKeys(v).length===Object.keys(v).length&&
  Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>Object.hasOwn(d,"value"));
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<max&&
  Reflect.ownKeys(v).length===v.length+1&&
  Array.from({length:v.length},(_,i)=>i).every(i=>Object.hasOwn(v,i));
function exactServiceCondition(conditions:unknown):string|null|undefined {
 if(!dense(conditions,11))return undefined;
 if(conditions.length===0)return null;
 if(conditions.length!==1)return undefined;
 const c=conditions[0];
 if(!plain(c)||Object.keys(c).length!==3||
   !["field","operator","value"].every(k=>Object.hasOwn(c,k)))return undefined;
 if(c.field!=="request.serviceCode"||c.operator!=="EQ"||
   !["STANDARD","DEEP","MOVE_OUT"].includes(String(c.value)))return undefined;
 return c.value as string;
}
function saved(v:unknown,ws:string,branch:string):v is WorkflowRuleVersionDTO {
 if(!plain(v)||v.workspaceId!==ws||v.branchId!==branch||
   !id(v.id)||!id(v.ruleId)||v.state!=="PUBLISHED"||
   !events.has(String(v.eventType))||
   !Number.isSafeInteger(v.versionNumber)||Number(v.versionNumber)<1||
   exactServiceCondition(v.conditions)===undefined||
   !dense(v.actions,6)||v.actions.length===0)return false;
 return v.actions.every(a=>plain(a)&&
   ["CREATE_ATTENTION","SEND_EMAIL_TEMPLATE","SEND_WHATSAPP_TEMPLATE"].includes(String(a.type)));
}
function candidate(v:unknown,ws:string,branch:string):v is ProposedOwnerWorkflowDraft{
 if(!plain(v)||v.workspaceId!==ws||v.branchId!==branch||
   v.state!=="DRAFT_REQUIRES_OWNER_REVIEW"||
   v.source!=="UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED"||
   v.published!==false||v.previewOnly!==true||
   v.requiresOwnerPublish!==true||v.sendsCustomerMessages!==false||
   v.mutatesFinancialState!==false||v.maxActionsPerEvent!==1||
   !events.has(String(v.eventType))||
   exactServiceCondition(v.conditions)===undefined||
   !dense(v.actions,2)||v.actions.length!==1)return false;
 return plain(v.actions[0])&&v.actions[0].type==="CREATE_ATTENTION"&&
   Object.keys(v.actions[0]).length===3&&
   ["type","severity","summaryKey"].every(k=>Object.hasOwn(v.actions[0],k));
}

/** Compared against supplied, authoritative saved published rule versions.
 * A missing/incomplete inventory cannot prove global absence of conflicts;
 * possible complex overlaps are NEVER silently called disjoint. */
export function reviewSavedRuleOverlap(input:SavedRuleInventoryInput):SavedRuleOverlapResult{
 if(!input||!input.actor||input.actor.role!=="OWNER"||
   !id(input.workspaceId)||!id(input.branchId)||
   input.actor.workspaceId!==input.workspaceId)
   return {ok:false,code:"RULE_INVENTORY_OWNER_REQUIRED"};
 if(input.inventorySource!=="SAVED_PUBLISHED_RULE_VERSIONS"||
   !dense(input.currentPublished,201)||!dense(input.proposed,26)||
   input.proposed.length===0)return {ok:false,code:"RULE_INVENTORY_UNVERIFIED"};
 const seen=new Set<string>();
 for(const r of input.currentPublished){
   if(!saved(r,input.workspaceId,input.branchId)||seen.has(r.ruleId))
     return {ok:false,code:"RULE_INVENTORY_UNVERIFIED"};
   seen.add(r.ruleId);
 }
 if(!input.proposed.every(r=>candidate(r,input.workspaceId,input.branchId)))
   return {ok:false,code:"RULE_INVENTORY_UNVERIFIED"};
 const overlaps:Extract<SavedRuleOverlapResult,{ok:true}>["value"]["overlaps"]=[];
 for(let i=0;i<input.proposed.length;i++){
   const draft=input.proposed[i];
   for(const rule of input.currentPublished){
     if(rule.eventType!==draft.eventType)continue;
     const a=exactServiceCondition(rule.conditions),b=exactServiceCondition(draft.conditions);
     // Both precise but different catalog services are proved disjoint.
     if(a!==null&&b!==null&&a!==b)continue;
     const kind:Overlap=a===null&&b===null?"CERTAIN_SAME_EVENT_UNCONDITIONAL":
       a!==null&&b!==null&&a===b?"CERTAIN_SAME_SERVICE_FILTER":
       "POSSIBLE_CONDITION_OVERLAP";
     overlaps.push({publishedRuleId:rule.ruleId,versionNumber:rule.versionNumber,
       draftIndex:i,eventType:rule.eventType,kind});
   }
 }
 return {ok:true,value:{
   state:"OWNER_PUBLISHED_RULE_OVERLAP_REVIEW",
   source:"SAVED_PUBLISHED_RULE_VERSIONS",inspectedPublished:input.currentPublished.length,
   inspectedProposed:input.proposed.length,overlapCount:overlaps.length,
   overlaps,noOverlapsInSuppliedInventory:overlaps.length===0,
   completeInventoryNotProven:true,ownerReviewRequired:true,
   published:false,executed:false,providerMessageSent:false,paymentChanged:false,
 }};
}
