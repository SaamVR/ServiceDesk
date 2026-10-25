import {
  loadOperationalStaffSnapshot,
  type OperationalStaffSnapshot,
} from "@/features/operations/operational-product-runtime";
import { trustedQuoteInstant } from "@/features/operations/quote-validity-clock";

type Loader = typeof loadOperationalStaffSnapshot;
export interface F02QualityDependencies {
  loadSnapshot?: Loader;
  now?: () => number;
  signal?: AbortSignal;
}
export type F02QualityDenial =
  | "F02_QUALITY_INPUT_INVALID" | "F02_QUALITY_AUTH_REQUIRED" |
    "F02_QUALITY_READ_UNAVAILABLE" | "F02_QUALITY_SOURCE_UNVERIFIED" |
    "F02_QUALITY_SOURCE_CHANGED" | "F02_QUALITY_NOT_REVIEWABLE" |
    "F02_QUALITY_CANCELLED";
export type F02QualityFinding =
  | "BEFORE_EVIDENCE_RECORD_MISSING" | "AFTER_EVIDENCE_RECORD_MISSING" |
    "CHECKLIST_NOT_RECORDED" | "CHECKLIST_STILL_INCOMPLETE" |
    "INCIDENT_REQUIRES_OWNER_ASSESSMENT" | "QUALITY_CASE_REQUIRES_STAFF_REVIEW" |
    "PHOTO_MEDIA_NOT_VERIFIED_BY_SNAPSHOT";
export type F02QualityStep =
  | "CHECK_SAVED_PHOTO_OBJECTS_MANUALLY" | "REQUEST_MISSING_FIELD_EVIDENCE" |
    "REVIEW_INCOMPLETE_CHECKLIST_ITEMS" | "ESCALATE_RECORDED_INCIDENT" |
    "REVIEW_OPEN_QUALITY_CASE" | "PERFORM_MANUAL_SIGNOFF";
export type F02QualityResult =
  | { ok: false; code: F02QualityDenial }
  | { ok: true; value: {
      state: "SAVED_VISIT_REWORK_ADVISORY_REQUIRES_HUMAN_REVIEW";
      source: "DOUBLE_READ_AUTHORIZED_VISIT_CHECKLIST_AND_EVIDENCE";
      workspaceId: string;
      visitId: string;
      visitVersion: number;
      sourceClock: string;
      evidence: {
        beforeRecordCount: number;
        afterRecordCount: number;
        incidentRecordCount: number;
        completedChecklistCount: number;
        checklistCount: number;
        openQualityCaseCount: number;
        photoMediaVerified: false;
      };
      findings: F02QualityFinding[];
      suggestedManualSteps: F02QualityStep[];
      humanApprovalRequired: true;
      reworkScheduled: false;
      statusMutated: false;
      messagesSent: false;
      modelInvoked: false;
    } };

const fail=(code:F02QualityDenial):F02QualityResult=>({ok:false,code});
const id=(x:unknown):x is string=>typeof x==="string" && /^[A-Za-z0-9:_-]{3,128}$/.test(x);
const timestamp=(v:unknown)=>trustedQuoteInstant(v);
const goodInt=(x:unknown)=>typeof x==="number" && Number.isSafeInteger(x) && x>=1 && x<=1_000_000_000;
const dense=(x:unknown,max:number): x is Record<string,unknown>[] =>
  Array.isArray(x) && Object.getPrototypeOf(x)===Array.prototype &&
  x.length<max && Reflect.ownKeys(x).length===x.length+1 &&
  x.every(row=>!!row && typeof row==="object" && !Array.isArray(row) &&
    Object.getPrototypeOf(row)===Object.prototype);
function actorVerified(s:OperationalStaffSnapshot,slug:string,now:number):boolean {
  const at=timestamp(s.loadedAt), scope=s.branchScope;
  return s.workspace?.slug===slug && id(s.workspace.id) &&
    s.actor?.workspaceId===s.workspace.id && id(s.actor.userId) &&
    (s.actor.role==="OWNER" || s.actor.role==="DISPATCHER") &&
    scope!==undefined && (scope.mode==="ALL" || scope.mode==="BRANCH") &&
    (s.actor.role!=="DISPATCHER" || scope.mode==="BRANCH") &&
    (scope.mode!=="BRANCH" || id(scope.selectedBranchId)) &&
    Number.isFinite(now) && at!==null && at>=now-300_000 && at<=now+60_000;
}
const safeValues=(rows:readonly object[],keys:string[]) =>
  rows.map(row=>keys.map(k=>(row as Record<string,unknown>)[k] ?? null))
    .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));

function savedProof(s:OperationalStaffSnapshot,visitId:string):{
  key:string;
  visit:OperationalStaffSnapshot["visits"][number];
  evidence:OperationalStaffSnapshot["visitEvidence"];
  checklist:OperationalStaffSnapshot["visitChecklistItems"];
  cases:OperationalStaffSnapshot["qualityCases"];
}|null {
  if(!dense(s.visits,300)||!dense(s.visitEvidence,1000)||
     !dense(s.visitChecklistItems,1000)||!dense(s.qualityCases,300))return null;
  const validBranch=new Set(s.branchScope?.branches.map(b=>b.id)??[]);
  const visitIds=new Set<string>();
  for(const v of s.visits){
    if(!id(v.id)||visitIds.has(v.id)||v.workspaceId!==s.workspace.id||
       !id(v.branchId)||!validBranch.has(v.branchId)||
       (s.branchScope?.mode==="BRANCH" && v.branchId!==s.branchScope.selectedBranchId)||
       !goodInt(v.version) ||
       !["AWAITING_PAYMENT","CONFIRMED","ASSIGNED","EN_ROUTE","IN_PROGRESS",
         "PENDING_REVIEW","COMPLETED","CANCELLED","PAYMENT_REVIEW"].includes(v.status))
      return null;
    visitIds.add(v.id);
  }
  const seen=new Set<string>();
  for(const e of s.visitEvidence){
    if(!id(e.id)||seen.has(e.id)||!visitIds.has(e.visitId)||
       !["BEFORE_PHOTO","AFTER_PHOTO","ISSUE_PHOTO","TIME_MATERIAL_NOTE","INCIDENT_NOTE"].includes(e.kind)||
       timestamp(e.capturedAt)===null||
       (e.text!==undefined && (typeof e.text!=="string" || e.text.length>10_000)))
      return null;
    seen.add(e.id);
  }
  seen.clear();
  const keys=new Set<string>();
  for(const c of s.visitChecklistItems){
    const k=c.visitId+":"+c.itemKey;
    if(!id(c.id)||seen.has(c.id)||!visitIds.has(c.visitId)||!id(c.itemKey)||
       keys.has(k)||typeof c.completed!=="boolean"||!goodInt(c.version)||
       (c.note!==undefined && (typeof c.note!=="string" || c.note.length>10_000)))
      return null;
    seen.add(c.id);keys.add(k);
  }
  seen.clear();
  for(const q of s.qualityCases){
    if(!id(q.id)||seen.has(q.id)||!visitIds.has(q.visitId)||
       !["OPEN","IN_REVIEW","RESOLVED"].includes(q.state)||!goodInt(q.version))
      return null;
    seen.add(q.id);
  }
  const visit=s.visits.find(v=>v.id===visitId);
  if(!visit)return null;
  const evidence=s.visitEvidence.filter(e=>e.visitId===visitId);
  const checklist=s.visitChecklistItems.filter(c=>c.visitId===visitId);
  const cases=s.qualityCases.filter(c=>c.visitId===visitId);
  // Ignore mutable, untrusted natural-language note content in outward advice;
  // DO compare it across reads so a changed saved source cannot be mislabeled
  // as the revision that staff initially opened.
  const key=JSON.stringify({
    scope:[s.branchScope?.mode,s.branchScope?.selectedBranchId??null,
      [...validBranch].sort()],
    visit:safeValues([visit],["id","workspaceId","branchId","status","version","crewId","startAt"]),
    evidence:safeValues(evidence,["id","visitId","kind","capturedAt","text"]),
    checklist:safeValues(checklist,["id","visitId","itemKey","completed","version","note"]),
    cases:safeValues(cases,["id","visitId","state","version","reviewRequestState"]),
  });
  return {key,visit,evidence,checklist,cases};
}

/** Advisory plan from the saved snapshot only. Photo metadata in the
 * operations snapshot does not include verified object references. Therefore
 * a photo row is never an assertion of actual media proof or completed work.
 * No external model, provider, status, approval or rework writer is called.
 */
export async function proposeSavedVisitReworkReview(
  workspaceSlug:string,visitId:string,deps:F02QualityDependencies={},
):Promise<F02QualityResult> {
  if(typeof workspaceSlug!=="string" || workspaceSlug.length>40 ||
     !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||!id(visitId))
    return fail("F02_QUALITY_INPUT_INVALID");
  if(deps.signal?.aborted)return fail("F02_QUALITY_CANCELLED");
  const load=deps.loadSnapshot??loadOperationalStaffSnapshot,now=deps.now??Date.now;
  let first:Awaited<ReturnType<Loader>>;
  try{first=await load(workspaceSlug);}catch{return fail("F02_QUALITY_READ_UNAVAILABLE");}
  if(!first.ok || !actorVerified(first.value,workspaceSlug,now()))
    return fail("F02_QUALITY_AUTH_REQUIRED");
  const proof=savedProof(first.value,visitId);
  if(!proof)return fail("F02_QUALITY_SOURCE_UNVERIFIED");
  if(!["PENDING_REVIEW","COMPLETED"].includes(proof.visit.status))
    return fail("F02_QUALITY_NOT_REVIEWABLE");
  if(deps.signal?.aborted)return fail("F02_QUALITY_CANCELLED");
  let next:Awaited<ReturnType<Loader>>;
  try{next=await load(workspaceSlug);}catch{return fail("F02_QUALITY_READ_UNAVAILABLE");}
  if(!next.ok || !actorVerified(next.value,workspaceSlug,now()) ||
     next.value.workspace.id!==first.value.workspace.id ||
     next.value.actor.userId!==first.value.actor.userId ||
     next.value.actor.role!==first.value.actor.role)
    return fail("F02_QUALITY_AUTH_REQUIRED");
  const fresh=savedProof(next.value,visitId);
  if(!fresh || fresh.key!==proof.key)return fail("F02_QUALITY_SOURCE_CHANGED");
  if(deps.signal?.aborted)return fail("F02_QUALITY_CANCELLED");

  const before=fresh.evidence.filter(e=>e.kind==="BEFORE_PHOTO").length;
  const after=fresh.evidence.filter(e=>e.kind==="AFTER_PHOTO").length;
  const incident=fresh.evidence.filter(e=>e.kind==="INCIDENT_NOTE"||e.kind==="ISSUE_PHOTO").length;
  const completed=fresh.checklist.filter(c=>c.completed).length;
  const openCases=fresh.cases.filter(q=>q.state!=="RESOLVED").length;
  const findings:F02QualityFinding[]=["PHOTO_MEDIA_NOT_VERIFIED_BY_SNAPSHOT"];
  const steps:F02QualityStep[]=["CHECK_SAVED_PHOTO_OBJECTS_MANUALLY"];
  if(before===0){findings.push("BEFORE_EVIDENCE_RECORD_MISSING");steps.push("REQUEST_MISSING_FIELD_EVIDENCE");}
  if(after===0){findings.push("AFTER_EVIDENCE_RECORD_MISSING");
    if(!steps.includes("REQUEST_MISSING_FIELD_EVIDENCE"))steps.push("REQUEST_MISSING_FIELD_EVIDENCE");}
  if(fresh.checklist.length===0){findings.push("CHECKLIST_NOT_RECORDED");steps.push("REVIEW_INCOMPLETE_CHECKLIST_ITEMS");}
  else if(completed!==fresh.checklist.length){findings.push("CHECKLIST_STILL_INCOMPLETE");steps.push("REVIEW_INCOMPLETE_CHECKLIST_ITEMS");}
  if(incident>0){findings.push("INCIDENT_REQUIRES_OWNER_ASSESSMENT");steps.push("ESCALATE_RECORDED_INCIDENT");}
  if(openCases>0){findings.push("QUALITY_CASE_REQUIRES_STAFF_REVIEW");steps.push("REVIEW_OPEN_QUALITY_CASE");}
  steps.push("PERFORM_MANUAL_SIGNOFF");
  return {ok:true,value:{
    state:"SAVED_VISIT_REWORK_ADVISORY_REQUIRES_HUMAN_REVIEW",
    source:"DOUBLE_READ_AUTHORIZED_VISIT_CHECKLIST_AND_EVIDENCE",
    workspaceId:next.value.workspace.id,visitId,visitVersion:fresh.visit.version,
    sourceClock:next.value.loadedAt,evidence:{
      beforeRecordCount:before,afterRecordCount:after,incidentRecordCount:incident,
      checklistCount:fresh.checklist.length,completedChecklistCount:completed,
      openQualityCaseCount:openCases,photoMediaVerified:false,
    },
    findings,suggestedManualSteps:steps,humanApprovalRequired:true,
    reworkScheduled:false,statusMutated:false,messagesSent:false,modelInvoked:false,
  }};
}
