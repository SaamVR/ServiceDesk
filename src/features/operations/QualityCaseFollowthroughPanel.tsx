import Link from "next/link";
import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {guideF19SavedQualityCase} from "./f19-quality-case-guidance";
import {AiSavedVisitQualityReview} from "./AiSavedVisitQualityReview";
import {buildStaffModuleHref} from "./staff-modules";
const descriptions={
 SOURCE_UNVERIFIED:"Case revision or evidence counts are not verified. Reload before performing any command.",
 VISIT_NOT_FOUND:"The related authorized visit is missing or has an invalid revision. Investigate the source job.",
 REVIEW_NOT_STARTED:"This saved case has not begun human review. Use Start review in the authoritative case record.",
 EVIDENCE_NOT_CERTIFIED:"The case is in review, but field state, checklist or evidence is incomplete. Inspect saved field records and actual photo objects.",
 STAFF_RESOLUTION_REQUIRED:"Evidence metadata exists; an authorized reviewer must still inspect actual media, incidents and customer outcome before recording a resolution.",
 CLOSED_NEEDS_SIGNOFF:"This case is marked resolved. Independently verify its human resolution and customer review consent before follow-up.",
} as const;
/** Explicit case selection prevents a secondary panel from misidentifying
 * the primary queue row when queue/search filters change. */
export async function QualityCaseFollowthroughPanel({workspaceSlug,selectedCaseId}:{
 workspaceSlug:string;selectedCaseId?:string;
}){
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))return null;
 const source=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!source.ok||source.value.workspace.slug!==workspaceSlug||
    !["OWNER","DISPATCHER"].includes(source.value.actor.role))return null;
 const s=source.value, scope=s.branchScope;
 if(!scope||!["ALL","BRANCH"].includes(scope.mode))return null;
 const allowedBranches=new Set(scope.branches.map(b=>b.id));
 const visits=new Map(s.visits.filter(v=>v.workspaceId===s.workspace.id&&
   !!v.branchId&&allowedBranches.has(v.branchId)&&
   (scope.mode==="ALL"||v.branchId===scope.selectedBranchId))
   .map(v=>[v.id,v]));
 const cases=s.qualityCases.filter(q=>visits.has(q.visitId)&&
    Number.isSafeInteger(q.version)&&q.version>=1).slice(0,25);
 if(!cases.length)return null;
 const selected=selectedCaseId?cases.find(q=>q.id===selectedCaseId):undefined;
 const qualityHref=buildStaffModuleHref(workspaceSlug,"quality");
 if(!selected)return <section className="app-panel" aria-label="Quality follow-through case selection"
   data-testid="f19-quality-followthrough">
  <h2>Saved quality-case follow-through</h2>
  <p>Choose an authorized quality case to review. No case has been selected for this advisory.</p>
  <ul>{cases.map((q,i)=><li key={q.id}>
   <Link href={qualityHref+"?case="+encodeURIComponent(q.id)}>
    Case {i+1} · {q.state.replaceAll("_"," ").toLowerCase()}</Link>
  </li>)}</ul>
  <p>Only the first 25 authorized cases are included in this additional review panel.</p>
 </section>;
 const visit=visits.get(selected.visitId);
 const evidence=s.visitEvidence.filter(x=>x.visitId===selected.visitId);
 const checklist=s.visitChecklistItems.filter(x=>x.visitId===selected.visitId);
 const completed=checklist.filter(x=>x.completed).length;
 const guidance=guideF19SavedQualityCase(selected,visit,evidence.length,checklist.length,completed);
 const jobLink=buildStaffModuleHref(workspaceSlug,"jobs")+"?job="+
   encodeURIComponent(selected.visitId);
 const canReviewVisit=visit&&["PENDING_REVIEW","COMPLETED"].includes(visit.status);
 return <section className="app-panel" aria-label="Quality-case follow-through"
   data-testid="f19-quality-followthrough">
  <h2>Saved case: human follow-through</h2>
  <p>Saved case revision {selected.version} · {selected.state.replaceAll("_"," ").toLowerCase()}.
   Checklist {completed}/{checklist.length} · evidence records {evidence.length}.</p>
  <p role="status">{descriptions[guidance.code]}</p>
  <p>Evidence metadata never verifies that an actual photo object was uploaded or inspected.</p>
  {visit?<Link href={jobLink}>Open related job and actual field evidence</Link>:null}
  {canReviewVisit?<AiSavedVisitQualityReview
    workspaceSlug={workspaceSlug} visitId={selected.visitId}/>:(
     <p>Rework advisory is unavailable until the related saved job is pending review or completed. Resolve its field workflow first.</p>
  )}
  <p>Start review, resolve, or contact a customer only through separately authorized commands on the primary case page. No automatic resolution, message or rework scheduling occurred.</p>
 </section>;
}
