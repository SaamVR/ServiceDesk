import {
  planF15UnansweredLeadSla,
  type F15SlaDecision,
} from "./sonic-f15-unanswered-lead-sla";

type Candidate = Extract<F15SlaDecision,{ok:true}>["value"];

export interface F15AtomicEventCommand {
  eventKey: string;
  eventType: "UNANSWERED_LEAD_SLA_REVIEW";
  workspaceId: string;
  branchId: string;
  requestId: string;
  sourceVersion: number;
  sourceLastInboundAt: string;
  sourceLastInboundMessageId: string;
  thresholdMinutes: number;
  dueAt: string;
  observedAt: string;
  transactionalSourceRecheckRequired: true;
  uniqueEventKeyRequired: true;
  requiresOwnerReview: true;
  customerMessageAuthorized: false;
  financialMutationAuthorized: false;
}
export interface F15AtomicEventReceipt {
  state: "INSERTED" | "ALREADY_RECORDED";
  eventKey: string;
  workspaceId: string;
  branchId: string;
  requestId: string;
  sourceVersion: number;
  sourceLastInboundAt: string;
  sourceLastInboundMessageId: string;
  transactionCommitted: true;
  sourceRecheckedUnderLock: true;
  uniqueEventKeyEnforced: true;
  externalSideEffects: false;
  savedRowsInserted: 0 | 1;
}

/**
 * REQUIRED DURABLE PORT. Its implementation must atomically re-read current
 * request status/response history/tenant/branch/version and enforce a UNIQUE
 * event key inside one database transaction. In-memory Set/Redis cache is not
 * an acceptable production replacement. No live adapter is wired in F15.
 */
export interface F15AtomicIngressPort {
  claimVerifiedEvent(command: Readonly<F15AtomicEventCommand>): Promise<unknown>;
}
export type F15IngressResult =
  | {ok:false;code:"F15_NOT_DUE"|"F15_EVIDENCE_INVALID"|"F15_SCOPE_INVALID"|
      "F15_CLOCK_INVALID"|"F15_DURABLE_PORT_REQUIRED"|
      "F15_TRANSACTION_UNAVAILABLE"|"F15_TRANSACTION_RECEIPT_INVALID"}
  | {ok:true;value:{
      state:"DURABLY_RECORDED_FOR_HUMAN_REVIEW"|"IDEMPOTENT_REPLAY_CONFIRMED";
      eventKey:string;workspaceId:string;branchId:string;requestId:string;
      durableEventRecorded:true;duplicate:boolean;
      ownerApprovalStillRequired:true;workflowExecuted:false;
      providerCalled:false;customerMessageSent:false;moneyChanged:false;
    }};

const receiptKeys = [
  "state","eventKey","workspaceId","branchId","requestId","sourceVersion",
  "sourceLastInboundAt","sourceLastInboundMessageId","transactionCommitted","sourceRecheckedUnderLock",
  "uniqueEventKeyEnforced","externalSideEffects","savedRowsInserted",
] as const;

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.getPrototypeOf(value) !== Object.prototype) return false;
    const names = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return names.length === keys.length &&
      names.every(k => typeof k === "string" && keys.includes(k)) &&
      keys.every(k => Object.hasOwn(descriptors,k) && Object.hasOwn(descriptors[k],"value"));
  } catch { return false; }
}
function checkedReceipt(receipt: unknown, planned: Candidate): receipt is F15AtomicEventReceipt {
  if (!exact(receipt,receiptKeys)) return false;
  return (receipt.state === "INSERTED" || receipt.state === "ALREADY_RECORDED") &&
    receipt.eventKey === planned.eventKey &&
    receipt.workspaceId === planned.workspaceId &&
    receipt.branchId === planned.branchId &&
    receipt.requestId === planned.requestId &&
    receipt.sourceVersion === planned.sourceVersion &&
    receipt.sourceLastInboundAt === planned.sourceLastInboundAt &&
    receipt.sourceLastInboundMessageId === planned.sourceLastInboundMessageId &&
    receipt.transactionCommitted === true &&
    receipt.sourceRecheckedUnderLock === true &&
    receipt.uniqueEventKeyEnforced === true &&
    receipt.externalSideEffects === false &&
    receipt.savedRowsInserted === (receipt.state === "INSERTED" ? 1 : 0);
}

/**
 * A candidate is not ingested until a trusted durable implementation gives
 * an exact transaction receipt. No send, no payment, no automatic rule-run.
 */
export async function ingestF15UnansweredLeadCandidate(
  input: unknown, port?: F15AtomicIngressPort,
): Promise<F15IngressResult> {
  const decision = planF15UnansweredLeadSla(input);
  if (!decision.ok) return decision;
  const planned = decision.value;
  if (planned.state !== "UNPERSISTED_SLA_CANDIDATE")
    return {ok:false,code:"F15_NOT_DUE"};
  if (!port || typeof port.claimVerifiedEvent !== "function")
    return {ok:false,code:"F15_DURABLE_PORT_REQUIRED"};
  const cmd: F15AtomicEventCommand = Object.freeze({
    eventKey:planned.eventKey,eventType:planned.eventType,
    workspaceId:planned.workspaceId,branchId:planned.branchId,
    requestId:planned.requestId,sourceVersion:planned.sourceVersion,
    sourceLastInboundAt:planned.sourceLastInboundAt,
    sourceLastInboundMessageId:planned.sourceLastInboundMessageId,
    thresholdMinutes:planned.thresholdMinutes,
    dueAt:planned.dueAt,observedAt:planned.observedAt,
    transactionalSourceRecheckRequired:true,uniqueEventKeyRequired:true,
    requiresOwnerReview:true,customerMessageAuthorized:false,
    financialMutationAuthorized:false,
  });
  let receipt: unknown;
  try { receipt = await port.claimVerifiedEvent(cmd); }
  catch { return {ok:false,code:"F15_TRANSACTION_UNAVAILABLE"}; }
  if (!checkedReceipt(receipt,planned))
    return {ok:false,code:"F15_TRANSACTION_RECEIPT_INVALID"};
  return {ok:true,value:{
    state:receipt.state==="INSERTED"?"DURABLY_RECORDED_FOR_HUMAN_REVIEW":
      "IDEMPOTENT_REPLAY_CONFIRMED",
    eventKey:planned.eventKey,workspaceId:planned.workspaceId,
    branchId:planned.branchId,requestId:planned.requestId,
    durableEventRecorded:true,duplicate:receipt.state==="ALREADY_RECORDED",
    ownerApprovalStillRequired:true,workflowExecuted:false,
    providerCalled:false,customerMessageSent:false,moneyChanged:false,
  }};
}
