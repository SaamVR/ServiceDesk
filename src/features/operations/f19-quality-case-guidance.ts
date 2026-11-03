import type {OperationalQualityCase,OperationalVisit} from "./operational-product-runtime";
export type QualityCaseNextStep =
 "RELOAD_SAVED_CASE"|"OPEN_ATTACHED_JOB"|"START_CASE_REVIEW"|
 "VERIFY_FIELD_PROOF"|"RECORD_HUMAN_RESOLUTION"|"REVIEW_COMPLETED_CASE";
export type QualityCaseGuidance = {
 state:"HUMAN_QUALITY_CASE_REVIEW";code:
 "SOURCE_UNVERIFIED"|"VISIT_NOT_FOUND"|"REVIEW_NOT_STARTED"|"EVIDENCE_NOT_CERTIFIED"|
 "STAFF_RESOLUTION_REQUIRED"|"CLOSED_NEEDS_SIGNOFF";
 next:QualityCaseNextStep;canResolveAutomatically:false;
 photoObjectsVerified:false;customerContactSent:false;reworkScheduled:false;
};
const result=(code:QualityCaseGuidance["code"],next:QualityCaseNextStep):QualityCaseGuidance=>({
 state:"HUMAN_QUALITY_CASE_REVIEW",code,next,canResolveAutomatically:false,
 photoObjectsVerified:false,customerContactSent:false,reworkScheduled:false
});
/** Triage ONLY from a server-authorized saved quality case and linked visit.
 * Evidence row existence is never proof of actual photo media or customer contact. */
export function guideF19SavedQualityCase(
 record:OperationalQualityCase,visit:OperationalVisit|undefined,
 evidenceCount:number,checklistCount:number,completedCount:number,
):QualityCaseGuidance{
 if(!record||!record.id||!Number.isSafeInteger(record.version)||record.version<1||
    !["OPEN","IN_REVIEW","RESOLVED"].includes(record.state)||
    !Number.isSafeInteger(evidenceCount)||evidenceCount<0||
    !Number.isSafeInteger(checklistCount)||checklistCount<0||
    !Number.isSafeInteger(completedCount)||completedCount<0||completedCount>checklistCount)
   return result("SOURCE_UNVERIFIED","RELOAD_SAVED_CASE");
 if(!visit||record.visitId!==visit.id||!Number.isSafeInteger(visit.version)||
    visit.version<1)return result("VISIT_NOT_FOUND","OPEN_ATTACHED_JOB");
 if(record.state==="OPEN")return result("REVIEW_NOT_STARTED","START_CASE_REVIEW");
 if(record.state==="RESOLVED")return result("CLOSED_NEEDS_SIGNOFF","REVIEW_COMPLETED_CASE");
 if(!["PENDING_REVIEW","COMPLETED"].includes(visit.status)||
    evidenceCount===0||checklistCount===0||completedCount<checklistCount)
   return result("EVIDENCE_NOT_CERTIFIED","VERIFY_FIELD_PROOF");
 return result("STAFF_RESOLUTION_REQUIRED","RECORD_HUMAN_RESOLUTION");
}
