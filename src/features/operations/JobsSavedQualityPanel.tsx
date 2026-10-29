import Link from "next/link";
import { loadOperationalStaffSnapshot } from "./operational-product-runtime";
import { AiSavedVisitQualityReview } from "./AiSavedVisitQualityReview";
import { buildStaffModuleHref } from "./staff-modules";

/** Server-only secondary QA surface on the existing Jobs route, not a
 * replacement for the authoritative Jobs renderer. It never exposes names,
 * field notes, photo metadata or identifiers except scoped visit links. */
export async function JobsSavedQualityPanel({workspaceSlug,selectedJobId}:{
 workspaceSlug:string;selectedJobId?:string;
}){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))return null;
 const result=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!result.ok || result.value.workspace.slug!==workspaceSlug ||
   !["OWNER","DISPATCHER"].includes(result.value.actor.role))return null;
 const scope=result.value.branchScope;
 if(!scope || !["ALL","BRANCH"].includes(scope.mode))return null;
 const allowed=new Set(scope.branches.map(b=>b.id));
 const visits=result.value.visits.filter(v=>v.workspaceId===result.value.workspace.id &&
   typeof v.branchId==="string"&&allowed.has(v.branchId) &&
   (scope.mode==="ALL"||scope.selectedBranchId===v.branchId)&&
   ["PENDING_REVIEW","COMPLETED"].includes(v.status) &&
   Number.isSafeInteger(v.version)&&v.version>0).slice(0,20);
 if(!visits.length)return null;
 const selected=visits.find(v=>v.id===selectedJobId)??visits[0];
 const href=buildStaffModuleHref(workspaceSlug,"jobs");
 return <section className="app-panel" aria-label="Saved field quality review workbench"
  data-testid="f17-jobs-quality-workbench">
  <h2>Field quality and rework review</h2>
  <p>Choose one authorized visit awaiting review or already completed. The action rechecks persisted visit evidence and your role twice; it does not approve a job.</p>
  <nav aria-label="Available saved visits for quality review">
   <ul>{visits.map((v,i)=><li key={v.id}>
    {v.id===selected.id?<strong>Job {i+1} · {v.status.replaceAll("_"," ").toLowerCase()} · selected</strong>:
    <Link href={href+"?job="+encodeURIComponent(v.id)}>
     Job {i+1} · {v.status.replaceAll("_"," ").toLowerCase()}
    </Link>}
   </li>)}</ul>
  </nav>
  <AiSavedVisitQualityReview workspaceSlug={workspaceSlug} visitId={selected.id}/>
  <p>Only the first 20 authorized reviewable visits are listed. Other work remains in the main Jobs queue.</p>
 </section>;
}
