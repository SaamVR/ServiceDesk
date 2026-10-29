"use server";
import { proposeSavedVisitReworkReview } from "@/server/ai/f02-saved-visit-quality";
export type F17QualityResult =
 | {ok:false;state:"VISIT_QUALITY_UNAVAILABLE"}
 | {ok:true;state:"SAVED_VISIT_QUALITY_REVIEW";visitVersion:number;
 evidence:{beforeRecordCount:number;afterRecordCount:number;incidentRecordCount:number;
 completedChecklistCount:number;checklistCount:number;openQualityCaseCount:number};
 findings:Array<"BEFORE_EVIDENCE_RECORD_MISSING"|"AFTER_EVIDENCE_RECORD_MISSING"|
 "CHECKLIST_NOT_RECORDED"|"CHECKLIST_STILL_INCOMPLETE"|
 "INCIDENT_REQUIRES_OWNER_ASSESSMENT"|"QUALITY_CASE_REQUIRES_STAFF_REVIEW"|
 "PHOTO_MEDIA_NOT_VERIFIED_BY_SNAPSHOT">;
 manualSteps:Array<"CHECK_SAVED_PHOTO_OBJECTS_MANUALLY"|"REQUEST_MISSING_FIELD_EVIDENCE"|
 "REVIEW_INCOMPLETE_CHECKLIST_ITEMS"|"ESCALATE_RECORDED_INCIDENT"|
 "REVIEW_OPEN_QUALITY_CASE"|"PERFORM_MANUAL_SIGNOFF">;
 humanApprovalRequired:true;photoMediaVerified:false;reworkScheduled:false;
 statusMutated:false;messagesSent:false;modelInvoked:false};
const failed=():F17QualityResult=>({ok:false,state:"VISIT_QUALITY_UNAVAILABLE"});
const allowedFindings=new Set([
 "BEFORE_EVIDENCE_RECORD_MISSING","AFTER_EVIDENCE_RECORD_MISSING",
 "CHECKLIST_NOT_RECORDED","CHECKLIST_STILL_INCOMPLETE",
 "INCIDENT_REQUIRES_OWNER_ASSESSMENT","QUALITY_CASE_REQUIRES_STAFF_REVIEW",
 "PHOTO_MEDIA_NOT_VERIFIED_BY_SNAPSHOT",
]);
const allowedSteps=new Set([
 "CHECK_SAVED_PHOTO_OBJECTS_MANUALLY","REQUEST_MISSING_FIELD_EVIDENCE",
 "REVIEW_INCOMPLETE_CHECKLIST_ITEMS","ESCALATE_RECORDED_INCIDENT",
 "REVIEW_OPEN_QUALITY_CASE","PERFORM_MANUAL_SIGNOFF",
]);
const count=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<1000;
/** Server-authorized, two-snapshot field evidence review; no media proof,
 * automatic case resolution, crew state change, model provider or sends. */
export async function requestF17SavedVisitQualityReview(slug:string,visitId:string):Promise<F17QualityResult>{
 if(typeof slug!=="string"||slug.length<3||slug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||
    typeof visitId!=="string"||visitId.length<3||visitId.length>128||
    !/^[A-Za-z0-9:_-]+$/.test(visitId)) return failed();
 try {
  const result=await proposeSavedVisitReworkReview(slug,visitId);
  if(!result.ok)return failed();
  const v=result.value, e=v.evidence;
  if(v.state!=="SAVED_VISIT_REWORK_ADVISORY_REQUIRES_HUMAN_REVIEW"||
     v.source!=="DOUBLE_READ_AUTHORIZED_VISIT_CHECKLIST_AND_EVIDENCE"||
     v.visitId!==visitId||!Number.isSafeInteger(v.visitVersion)||v.visitVersion<1||
     v.humanApprovalRequired!==true||v.reworkScheduled!==false||
     v.statusMutated!==false||v.messagesSent!==false||v.modelInvoked!==false||
     e.photoMediaVerified!==false||
     ![e.beforeRecordCount,e.afterRecordCount,e.incidentRecordCount,
       e.completedChecklistCount,e.checklistCount,e.openQualityCaseCount].every(count)||
     e.completedChecklistCount>e.checklistCount||
     !Array.isArray(v.findings)||v.findings.length>7||
     !Array.isArray(v.suggestedManualSteps)||v.suggestedManualSteps.length>7||
     !v.findings.every(x=>allowedFindings.has(x))||
     !v.suggestedManualSteps.every(x=>allowedSteps.has(x))||
     !v.findings.includes("PHOTO_MEDIA_NOT_VERIFIED_BY_SNAPSHOT"))return failed();
  return {ok:true,state:"SAVED_VISIT_QUALITY_REVIEW",visitVersion:v.visitVersion,
   evidence:{beforeRecordCount:e.beforeRecordCount,afterRecordCount:e.afterRecordCount,
    incidentRecordCount:e.incidentRecordCount,completedChecklistCount:e.completedChecklistCount,
    checklistCount:e.checklistCount,openQualityCaseCount:e.openQualityCaseCount},
   findings:v.findings,manualSteps:v.suggestedManualSteps,
   humanApprovalRequired:true,photoMediaVerified:false,reworkScheduled:false,
   statusMutated:false,messagesSent:false,modelInvoked:false};
 } catch {return failed();}
}
