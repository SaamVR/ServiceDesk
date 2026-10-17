import type { Result, WorkflowActionDTO, WorkflowConditionDTO, WorkflowEventType } from "../../contracts";

/**
 * A model proposal is untrusted input, not a published workflow or permission
 * to write a rule. Only one already-authorized OWNER and branch may preview
 * this strict one-event / one-internal-attention draft.
 */
export interface ModelWorkflowDraftCandidate {
  eventType: WorkflowEventType;
  serviceCode?: "STANDARD" | "DEEP" | "MOVE_OUT";
  severity: "INFO" | "WARNING" | "CRITICAL";
}
export interface OwnerWorkflowDraftScope {
  workspaceId: string;
  branchId: string;
  actorWorkspaceId: string;
  role: "OWNER" | "DISPATCHER" | "STAFF";
}
export interface ProposedOwnerWorkflowDraft {
  state: "DRAFT_REQUIRES_OWNER_REVIEW";
  source: "UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED";
  workspaceId: string;
  branchId: string;
  eventType: WorkflowEventType;
  conditions: WorkflowConditionDTO[];
  actions: WorkflowActionDTO[];
  maxActionsPerEvent: 1;
  published: false;
  requiresOwnerPublish: true;
  previewOnly: true;
  sendsCustomerMessages: false;
  mutatesFinancialState: false;
}

const supported: readonly WorkflowEventType[] = [
  "REQUEST_CREATED", "QUOTE_ACCEPTED", "VISIT_COMPLETED",
  "INVOICE_PAID", "ATTENTION_OPENED",
];
const codes = ["STANDARD", "DEEP", "MOVE_OUT"] as const;
const severities = ["INFO", "WARNING", "CRITICAL"] as const;
const identifiers = /^[A-Za-z0-9:_-]{3,128}$/;
const internalActionKey: Record<WorkflowEventType,string> = {
  REQUEST_CREATED:"AI_REVIEW_NEW_REQUEST",
  QUOTE_ACCEPTED:"AI_REVIEW_ACCEPTED_QUOTE",
  VISIT_COMPLETED:"AI_REVIEW_COMPLETED_VISIT",
  INVOICE_PAID:"AI_REVIEW_PAID_INVOICE",
  ATTENTION_OPENED:"AI_TRIAGE_EXCEPTION",
};

export function compileModelWorkflowDraft(
  value: unknown,
  scope: OwnerWorkflowDraftScope,
): Result<ProposedOwnerWorkflowDraft> {
  if (!scope || scope.role !== "OWNER" ||
      typeof scope.workspaceId !== "string" ||
      typeof scope.branchId !== "string" ||
      !identifiers.test(scope.workspaceId) ||
      !identifiers.test(scope.branchId) ||
      scope.actorWorkspaceId !== scope.workspaceId) {
    return {ok:false,code:"AI_WORKFLOW_OWNER_SCOPE_REQUIRED",
      message:"An authorized workspace owner must review workflow suggestions."};
  }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    return {ok:false,code:"AI_WORKFLOW_DRAFT_INVALID",
      message:"The suggested workflow must be a simple structured record."};
  }
  const raw=value as Record<string,unknown>;
  const allowed=["eventType","serviceCode","severity"];
  // A hidden own key is still a model-supplied permission attempt, even
  // if Object.keys would hide it from the reviewed draft provenance.
  if (Object.getOwnPropertyNames(raw).length !== Object.keys(raw).length ||
      Object.keys(raw).some(key=>!allowed.includes(key)) ||
      Object.getOwnPropertySymbols(raw).length ||
      Object.values(Object.getOwnPropertyDescriptors(raw)).some(d=>!Object.hasOwn(d,"value")) ||
      !supported.includes(raw.eventType as WorkflowEventType) ||
      !severities.includes(raw.severity as (typeof severities)[number])) {
    return {ok:false,code:"AI_WORKFLOW_DRAFT_INVALID",
      message:"The proposal contains unsupported triggers, fields, effects or severity."};
  }
  if (raw.serviceCode !== undefined &&
      (!codes.includes(raw.serviceCode as (typeof codes)[number]) ||
       raw.eventType === "ATTENTION_OPENED")) {
    return {ok:false,code:"AI_WORKFLOW_DRAFT_INVALID",
      message:"Only catalog-backed service conditions are supported for this event."};
  }
  const eventType=raw.eventType as WorkflowEventType;
  const conditions:WorkflowConditionDTO[]=raw.serviceCode===undefined?[]:[
    {field:"request.serviceCode",operator:"EQ",value:raw.serviceCode},
  ];
  return {ok:true,value:{
    state:"DRAFT_REQUIRES_OWNER_REVIEW",
    source:"UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED",
    workspaceId:scope.workspaceId,branchId:scope.branchId,
    eventType,conditions,
    actions:[{type:"CREATE_ATTENTION",
      severity:raw.severity as (typeof severities)[number],
      summaryKey:internalActionKey[eventType]}],
    maxActionsPerEvent:1,published:false,
    requiresOwnerPublish:true,previewOnly:true,
    sendsCustomerMessages:false,mutatesFinancialState:false,
  }};
}
