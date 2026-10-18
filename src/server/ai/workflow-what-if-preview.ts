import { compileModelWorkflowDraft, type OwnerWorkflowDraftScope } from "./workflow-draft-proposal";
import { evaluateWorkflowRule } from "../workflows/engine";
import type { WorkflowRuleVersionDTO } from "../../contracts";

/** Intentionally hypothetical; never accepts a claimed saved event as proof
 * of a real customer transaction or a confirmed workflow execution. */
export interface WorkflowWhatIfSample {
  serviceCode?: "STANDARD" | "DEEP" | "MOVE_OUT";
}
export type WorkflowWhatIfResult =
  | {ok:false;code:"WORKFLOW_WHAT_IF_INVALID"|"WORKFLOW_WHAT_IF_PREVIEW_BLOCKED"}
  | {ok:true;value:{
    state:"SYNTHETIC_RULE_PREVIEW_ONLY";
    inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT";
    workspaceId:string;branchId:string;eventType:WorkflowRuleVersionDTO["eventType"];
    matched:boolean;conditionCount:number;
    wouldCreateAttention:boolean;
    checkedConditions:Array<{field:string;matched:boolean}>;
    executed:false;published:false;customerMessaged:false;
    paymentChanged:false;ownerPublishStillRequired:true;
  }};

export function previewOwnerWorkflowWhatIf(
  rawCandidate:unknown,
  scope:OwnerWorkflowDraftScope,
  sample:WorkflowWhatIfSample,
):WorkflowWhatIfResult {
  const compiled=compileModelWorkflowDraft(rawCandidate,scope);
  if(!compiled.ok)return {ok:false,code:"WORKFLOW_WHAT_IF_INVALID"};
  if(!sample || typeof sample!=="object" || Array.isArray(sample) ||
      Object.getPrototypeOf(sample)!==Object.prototype ||
      Object.keys(sample).some(key=>key!=="serviceCode") ||
      Object.getOwnPropertyNames(sample).length!==Object.keys(sample).length ||
      Object.getOwnPropertySymbols(sample).length!==0 ||
      Object.values(Object.getOwnPropertyDescriptors(sample)).some(d=>!Object.hasOwn(d,"value")) ||
      (sample.serviceCode!==undefined &&
       !["STANDARD","DEEP","MOVE_OUT"].includes(sample.serviceCode))) {
    return {ok:false,code:"WORKFLOW_WHAT_IF_INVALID"};
  }
  const draft=compiled.value;
  // Never use a LIVE event identity, or publish a rule, from this simulation.
  // This sandbox evaluates the production rule engine with a synthetic input.
  const version:WorkflowRuleVersionDTO={
    id:"simulation-rule-version",ruleId:"simulation-rule",
    workspaceId:draft.workspaceId,branchId:draft.branchId,
    versionNumber:1,state:"DRAFT",eventType:draft.eventType,
    conditions:draft.conditions,actions:draft.actions,maxActionsPerEvent:1,
    createdAt:"2026-10-18T00:00:00.000Z",
  };
  const snapshot:Record<string,string>={};
  if(sample.serviceCode!==undefined &&
     draft.eventType!=="ATTENTION_OPENED" &&
     draft.eventType!=="INVOICE_PAID") {
    snapshot["request.serviceCode"]=sample.serviceCode;
  } else if(sample.serviceCode!==undefined && draft.eventType==="INVOICE_PAID"){
    snapshot["request.serviceCode"]=sample.serviceCode;
  }
  const plan=evaluateWorkflowRule(version,{
    workspaceId:draft.workspaceId,branchId:draft.branchId,
    eventType:draft.eventType,snapshot,recursionDepth:0,
  },"PREVIEW");
  if(!plan.ok)return {ok:false,code:"WORKFLOW_WHAT_IF_PREVIEW_BLOCKED"};
  return {ok:true,value:{
    state:"SYNTHETIC_RULE_PREVIEW_ONLY",
    inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT",
    workspaceId:draft.workspaceId,branchId:draft.branchId,eventType:draft.eventType,
    matched:plan.value.matched,conditionCount:plan.value.conditionDecisions.length,
    checkedConditions:plan.value.conditionDecisions.map(d=>({field:d.field,matched:d.matched})),
    wouldCreateAttention:plan.value.actionPlans.some(p=>p.action.type==="CREATE_ATTENTION"),
    executed:false,published:false,customerMessaged:false,
    paymentChanged:false,ownerPublishStillRequired:true,
  }};
}
