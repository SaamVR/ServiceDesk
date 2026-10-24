import {evaluateWorkflowRule} from "../workflows/engine";
import type {WorkflowRuleVersionDTO,WorkflowActionDTO,WorkflowConditionDTO} from "../../contracts";

export type AutomationRevisionFlag=
 "EVENT_CHANGED"|"CONDITIONS_CHANGED"|"ACTIONS_CHANGED"|
 "EXTERNAL_SEND_INTRODUCED"|"EXTERNAL_SEND_REMOVED";
export interface AutomationRevisionInput {
  actor:{workspaceId:string;role:"OWNER"|"DISPATCHER"|"CREW"|"CUSTOMER"};
  workspaceId:string;branchId:string;
  previous:WorkflowRuleVersionDTO|null;
  draft:WorkflowRuleVersionDTO;
}
export type AutomationRevisionResult=
 | {ok:false;code:"AUTOMATION_REVIEW_OWNER_REQUIRED"|"AUTOMATION_REVIEW_SOURCE_INVALID"|
  "AUTOMATION_REVIEW_VERSION_CONFLICT"}
 | {ok:true;value:{
   state:"AUTOMATION_REVISION_OWNER_REVIEW";
   ruleId:string;oldVersion:number|null;draftVersion:number;
   changes:AutomationRevisionFlag[];hasChanges:boolean;
   conditionCount:number;actionCount:number;externalActionCount:number;
   requiresExplicitExternalApproval:boolean;
   published:false;executed:false;customerMessaged:false;
 }};

const id=(v:unknown)=>typeof v==="string" && /^[A-Za-z0-9:_-]{3,128}$/.test(v);
const plain=(v:unknown):v is Record<string,unknown>=>
 !!v && typeof v==="object" && !Array.isArray(v) &&
 Object.getPrototypeOf(v)===Object.prototype &&
 Reflect.ownKeys(v).length===Object.keys(v).length &&
 Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>Object.hasOwn(d,"value"));
const dense=(v:unknown,max:number):v is unknown[]=>{
 if(!Array.isArray(v)||v.length>max||
    Reflect.ownKeys(v).length!==v.length+1)return false;
 return v.every((_,i)=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(i))??{},"value"));
};
const safeKey=(v:unknown)=>typeof v==="string" && /^[A-Za-z0-9_-]{1,80}$/.test(v);
function validCondition(v:unknown):v is WorkflowConditionDTO{
 if(!plain(v) || Object.keys(v).length!==3 ||
    !["field","operator","value"].every(k=>Object.hasOwn(v,k)) ||
    !safeKey(v.field) && !(typeof v.field==="string" &&
      /^[A-Za-z][A-Za-z0-9.]{1,79}$/.test(v.field)) ||
    !["EQ","NEQ","IN"].includes(String(v.operator)))return false;
 const val=v.value;
 return val===null || typeof val==="boolean" ||
   typeof val==="string" && val.length<=160 ||
   typeof val==="number" && Number.isFinite(val) ||
   dense(val,20) && val.every(x=>x===null || ["string","number","boolean"].includes(typeof x) &&
     (typeof x!=="number" || Number.isFinite(x)) && (typeof x!=="string" || x.length<=160));
}
function validAction(v:unknown):v is WorkflowActionDTO{
 if(!plain(v) || Object.keys(v).some(k=>![
     "type","severity","summaryKey","templateKey","recipient"].includes(k)))return false;
 if(v.type==="CREATE_ATTENTION")
   return ["INFO","WARNING","CRITICAL"].includes(String(v.severity)) &&
     safeKey(v.summaryKey) && v.templateKey===undefined && v.recipient===undefined;
 if(v.type==="SEND_EMAIL_TEMPLATE" || v.type==="SEND_WHATSAPP_TEMPLATE")
   return safeKey(v.templateKey) && v.recipient==="CUSTOMER_PRIMARY" &&
     v.summaryKey===undefined;
 return false;
}
function validVersion(v:unknown):v is WorkflowRuleVersionDTO{
 const keys=new Set(["id","workspaceId","branchId","ruleId","versionNumber",
   "state","eventType","conditions","actions","maxActionsPerEvent",
   "basedOnVersionNumber","publishedAt","createdAt"]);
 if(!plain(v) || Object.keys(v).some(key=>!keys.has(key)) ||
    !id(v.id)||!id(v.ruleId)||!id(v.workspaceId)||!id(v.branchId) ||
    !Number.isSafeInteger(v.versionNumber) || (v.versionNumber as number)<1 ||
    !["DRAFT","PUBLISHED"].includes(String(v.state)) ||
    !["REQUEST_CREATED","QUOTE_ACCEPTED","VISIT_COMPLETED","INVOICE_PAID","ATTENTION_OPENED"].includes(String(v.eventType)) ||
    !dense(v.conditions,8) || !dense(v.actions,5) || v.actions.length<1 ||
    !v.conditions.every(validCondition)||!v.actions.every(validAction) ||
    new Set(v.actions.map(a=>JSON.stringify(a))).size!==v.actions.length ||
    (typeof v.createdAt!=="string" ||
      !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(v.createdAt) ||
      !Number.isFinite(Date.parse(v.createdAt)) ||
      new Date(Date.parse(v.createdAt)).toISOString()!==v.createdAt) ||
    (v.publishedAt!==undefined && (typeof v.publishedAt!=="string" ||
      !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(v.publishedAt) ||
      !Number.isFinite(Date.parse(v.publishedAt)) ||
      new Date(Date.parse(v.publishedAt)).toISOString()!==v.publishedAt)) ||
    (v.basedOnVersionNumber!==undefined &&
      (!Number.isSafeInteger(v.basedOnVersionNumber) || (v.basedOnVersionNumber as number)<1)) ||
    !Number.isSafeInteger(v.maxActionsPerEvent) ||
    (v.maxActionsPerEvent as number)<1 ||
    (v.maxActionsPerEvent as number)>5 ||
    v.actions.length>(v.maxActionsPerEvent as number))return false;
 // A syntactically valid condition from another event family is not a
 // valid workflow revision. Reuse the production evaluator's event-specific
 // field allowlist in PREVIEW without any business side effects.
 // Every field used by the production evaluator has passed the strict
 // own-data-only validation above. Keep the cast localized after validation;
 // it grants no authority and cannot bypass the fail-closed runtime guards.
 const checked=evaluateWorkflowRule(v as unknown as WorkflowRuleVersionDTO,{
   workspaceId:v.workspaceId,branchId:v.branchId,eventType:v.eventType,
   snapshot:{},recursionDepth:0,
 },"PREVIEW");
 return checked.ok;
}
const external=(a:readonly WorkflowActionDTO[])=>a.filter(x=>
 x.type==="SEND_EMAIL_TEMPLATE"||x.type==="SEND_WHATSAPP_TEMPLATE").length;

/** Owner sees a source-grounded diff, never an AI authorization to publish. */
export function reviewAutomationRevision(input:AutomationRevisionInput):AutomationRevisionResult{
 if(!input || !input.actor || input.actor.role!=="OWNER" ||
    input.actor.workspaceId!==input.workspaceId ||
    !id(input.workspaceId)||!id(input.branchId))
   return {ok:false,code:"AUTOMATION_REVIEW_OWNER_REQUIRED"};
 if(!validVersion(input.draft) || input.draft.state!=="DRAFT" ||
    input.draft.workspaceId!==input.workspaceId ||
    input.draft.branchId!==input.branchId ||
    (input.previous!==null && !validVersion(input.previous)))
   return {ok:false,code:"AUTOMATION_REVIEW_SOURCE_INVALID"};
 const old=input.previous,draft=input.draft;
 if(old && (old.state!=="PUBLISHED" ||
    old.workspaceId!==input.workspaceId || old.branchId!==input.branchId ||
    old.ruleId!==draft.ruleId ||
    draft.versionNumber!==old.versionNumber+1 ||
    draft.basedOnVersionNumber!==old.versionNumber) ||
    !old && draft.versionNumber!==1)
   return {ok:false,code:"AUTOMATION_REVIEW_VERSION_CONFLICT"};
 const change:AutomationRevisionFlag[]=[];
 if(!old || old.eventType!==draft.eventType)change.push("EVENT_CHANGED");
 if(!old || JSON.stringify(old.conditions)!==JSON.stringify(draft.conditions))
   change.push("CONDITIONS_CHANGED");
 if(!old || JSON.stringify(old.actions)!==JSON.stringify(draft.actions))
   change.push("ACTIONS_CHANGED");
 const oldExternal=old?external(old.actions):0,nowExternal=external(draft.actions);
 if(nowExternal>oldExternal)change.push("EXTERNAL_SEND_INTRODUCED");
 if(nowExternal<oldExternal)change.push("EXTERNAL_SEND_REMOVED");
 return {ok:true,value:{
   state:"AUTOMATION_REVISION_OWNER_REVIEW",ruleId:draft.ruleId,
   oldVersion:old?.versionNumber??null,draftVersion:draft.versionNumber,
   changes:change,hasChanges:change.length>0,
   conditionCount:draft.conditions.length,
   actionCount:draft.actions.length,externalActionCount:nowExternal,
   requiresExplicitExternalApproval:nowExternal>0,
   published:false,executed:false,customerMessaged:false,
 }};
}
