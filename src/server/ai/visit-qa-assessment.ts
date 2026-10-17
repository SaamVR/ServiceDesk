import type { VisitDTO, VisitEvidenceDTO, VisitChecklistItemDTO } from "../../contracts";

export type FieldQaFinding =
  | "BEFORE_PHOTO_EVIDENCE_MISSING"
  | "AFTER_PHOTO_EVIDENCE_MISSING"
  | "CHECKLIST_UNAVAILABLE"
  | "CHECKLIST_INCOMPLETE"
  | "INCIDENT_REQUIRES_OWNER_REVIEW";

export interface FieldQaEvidenceInput {
  actor:{workspaceId:string;role:"OWNER"|"DISPATCHER"|"CREW"|"CUSTOMER"};
  workspaceId:string;
  visit:VisitDTO;
  evidence:readonly VisitEvidenceDTO[];
  checklist:readonly VisitChecklistItemDTO[];
}
export type FieldQaAssessment =
  | {ok:false;code:"QA_AUTHORITY_MISSING"|"QA_SOURCE_INVALID"|"QA_NOT_REVIEWABLE"}
  | {ok:true;value:{
    state:"HUMAN_QA_REVIEW_REQUIRED";
    source:"SERVER_SUPPLIED_VISIT_EVIDENCE_CONTRACT";
    workspaceId:string;visitId:string;visitVersion:number;
    findings:FieldQaFinding[];
    beforeEvidenceCount:number;afterEvidenceCount:number;
    completedChecklistCount:number;checklistCount:number;
    incidentEvidenceCount:number;
    approved:false;published:false;automatedCompletion:false;
  }};

const validId=(v:unknown):v is string=>
  typeof v==="string" && /^[A-Za-z0-9:_-]{3,128}$/.test(v);
const photoKinds=new Set(["BEFORE_PHOTO","AFTER_PHOTO","ISSUE_PHOTO"]);
const allKinds=new Set(["BEFORE_PHOTO","AFTER_PHOTO","ISSUE_PHOTO","TIME_MATERIAL_NOTE","INCIDENT_NOTE"]);

/** Run only on trusted server-read rows. This does not fetch, authorize or
 * summarize image pixels; a photo reference proves neither cleanliness nor
 * that an incident is resolved. Always require human quality approval. */
export function assessSavedVisitQuality(input:FieldQaEvidenceInput):FieldQaAssessment {
  const {actor,workspaceId,visit,evidence,checklist}=input??{};
  if (!actor || actor.workspaceId!==workspaceId ||
      (actor.role!=="OWNER" && actor.role!=="DISPATCHER") ||
      !validId(workspaceId)) return {ok:false,code:"QA_AUTHORITY_MISSING"};
  if (!visit || visit.workspaceId!==workspaceId ||
      !validId(visit.id) ||
      !Number.isSafeInteger(visit.version) || visit.version<1 ||
      !Array.isArray(evidence) || evidence.length>250 ||
      !Array.isArray(checklist) || checklist.length>150) {
    return {ok:false,code:"QA_SOURCE_INVALID"};
  }
  if (!["PENDING_REVIEW","COMPLETED"].includes(visit.status)) {
    return {ok:false,code:"QA_NOT_REVIEWABLE"};
  }
  const evidenceIds=new Set<string>();
  for(const item of evidence){
    if(!item || item.workspaceId!==workspaceId || item.visitId!==visit.id ||
        !validId(item.id) || evidenceIds.has(item.id) ||
        !allKinds.has(item.kind) ||
        (photoKinds.has(item.kind) && (!item.mediaReference ||
          typeof item.mediaReference.objectRef!=="string" ||
          item.mediaReference.objectRef.length<3 ||
          item.mediaReference.objectRef.length>512))) {
      return {ok:false,code:"QA_SOURCE_INVALID"};
    }
    evidenceIds.add(item.id);
  }
  const itemIds=new Set<string>(), itemKeys=new Set<string>();
  for(const item of checklist){
    if(!item || item.workspaceId!==workspaceId || item.visitId!==visit.id ||
        !validId(item.id) || itemIds.has(item.id) ||
        !validId(item.itemKey) || itemKeys.has(item.itemKey) ||
        typeof item.completed!=="boolean") {
      return {ok:false,code:"QA_SOURCE_INVALID"};
    }
    itemIds.add(item.id);itemKeys.add(item.itemKey);
  }
  const before=evidence.filter(e=>e.kind==="BEFORE_PHOTO").length;
  const after=evidence.filter(e=>e.kind==="AFTER_PHOTO").length;
  const incident=evidence.filter(e=>e.kind==="ISSUE_PHOTO" || e.kind==="INCIDENT_NOTE").length;
  const completed=checklist.filter(i=>i.completed).length;
  const findings:FieldQaFinding[]=[];
  if(before===0)findings.push("BEFORE_PHOTO_EVIDENCE_MISSING");
  if(after===0)findings.push("AFTER_PHOTO_EVIDENCE_MISSING");
  if(checklist.length===0)findings.push("CHECKLIST_UNAVAILABLE");
  else if(completed!==checklist.length)findings.push("CHECKLIST_INCOMPLETE");
  if(incident>0)findings.push("INCIDENT_REQUIRES_OWNER_REVIEW");
  return {ok:true,value:{
    state:"HUMAN_QA_REVIEW_REQUIRED",source:"SERVER_SUPPLIED_VISIT_EVIDENCE_CONTRACT",
    workspaceId,visitId:visit.id,visitVersion:visit.version,
    findings,beforeEvidenceCount:before,afterEvidenceCount:after,
    completedChecklistCount:completed,checklistCount:checklist.length,
    incidentEvidenceCount:incident,
    approved:false,published:false,automatedCompletion:false,
  }};
}
