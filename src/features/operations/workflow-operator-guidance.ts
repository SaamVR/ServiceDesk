import {classifyWorkflowIntervention,type InspectedWorkflow}
 from "./workflow-inspector-model";

/** Fixed operator guidance derived from persisted run states only.
 * Nothing here is a permission, replay plan, saved task or provider receipt. */
export type WorkflowOperatorDisposition =
 "HOLD_AND_RECONCILE"|"REVIEW_FAILURE"|"OWNER_APPROVAL_REQUIRED"|
 "PROCESSING_ONLY"|"NO_INTERVENTION_VERIFIED";
export interface WorkflowOperatorGuidance {
 disposition:WorkflowOperatorDisposition;
 severity:"CRITICAL"|"WARNING"|"INFO";
 title:string;detail:string;
 nextStep:"INSPECT_ACTION_ATTEMPTS"|"VERIFY_SOURCE_AND_RULE"|
   "OPEN_OWNER_APPROVAL"|"WAIT_FOR_SAVED_OUTCOME"|"NO_COMMAND";
 approvalStillRequired:true;
 automaticRetryAuthorized:false;
 automaticApprovalAuthorized:false;
 customerMessageAuthorized:false;
 financialMutationAuthorized:false;
 rulePublicationAuthorized:false;
 providerDeliveryVerified:false;
}
const fixed={
 HOLD_AND_RECONCILE:{
  severity:"CRITICAL",title:"Conflicting saved attempts — do not replay",
  detail:"The latest action slot is ambiguous. Compare saved attempts and rule/source identities before any separately authorized command.",
  nextStep:"INSPECT_ACTION_ATTEMPTS"},
 REVIEW_FAILURE:{
  severity:"WARNING",title:"Failed workflow — inspect authoritative evidence",
  detail:"Review the saved failure and linked record. Retry eligibility, idempotency and provider outcome are not established by this display.",
  nextStep:"VERIFY_SOURCE_AND_RULE"},
 OWNER_APPROVAL_REQUIRED:{
  severity:"WARNING",title:"Explicit owner decision required",
  detail:"A saved action is marked approval-required. An authorized owner must review the actual rule version and business record before acting.",
  nextStep:"OPEN_OWNER_APPROVAL"},
 PROCESSING_ONLY:{
  severity:"INFO",title:"Processing recorded — no intervention implied",
  detail:"The latest saved action is pending. This snapshot does not prove completion, failure, delivery or a missed deadline.",
  nextStep:"WAIT_FOR_SAVED_OUTCOME"},
 NO_INTERVENTION_VERIFIED:{
  severity:"INFO",title:"No intervention evidenced in this snapshot",
  detail:"Current recorded states contain no failed, ambiguous or approval-required action. This does not prove customer delivery or all-time success.",
  nextStep:"NO_COMMAND"},
} as const;
export function guideRecordedWorkflowIntervention(
 run:Pick<InspectedWorkflow,"ambiguousActionSlots"|"failedCount"|"approvalCount"|
 "pendingCount"|"state">,
):WorkflowOperatorGuidance{
 // Data is already projected from the authorized saved run inspector. Fail
 // conservatively if any external caller supplies malformed count/state.
 const count=[run?.ambiguousActionSlots,run?.failedCount,run?.approvalCount,run?.pendingCount];
 const invalid=!run||count.some(v=>typeof v!=="number"||
  !Number.isSafeInteger(v)||v<0||v>2000)||
  !["COMPLETED","SKIPPED","ACTIONS_PENDING","PARTIAL_FAILED","FAILED","PENDING"].includes(run.state);
 const disposition:WorkflowOperatorDisposition=invalid?"HOLD_AND_RECONCILE":
  run.ambiguousActionSlots>0?"HOLD_AND_RECONCILE":
  run.failedCount>0||run.state==="PARTIAL_FAILED"||run.state==="FAILED"?"REVIEW_FAILURE":
  run.approvalCount>0?"OWNER_APPROVAL_REQUIRED":
  run.pendingCount>0||run.state==="ACTIONS_PENDING"||run.state==="PENDING"?"PROCESSING_ONLY":
  "NO_INTERVENTION_VERIFIED";
 const decision=fixed[disposition];
 return {...decision,disposition,
  approvalStillRequired:true,automaticRetryAuthorized:false,
  automaticApprovalAuthorized:false,customerMessageAuthorized:false,
  financialMutationAuthorized:false,rulePublicationAuthorized:false,
  providerDeliveryVerified:false};
}
