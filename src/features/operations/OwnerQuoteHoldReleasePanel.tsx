import Link from "next/link";
import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
import {indexCurrentQuoteByRequest,indexAmbiguousCurrentQuoteRequests} from "./staff-snapshot-index";
import {OwnerSavedHoldReleaseControls} from "./OwnerSavedHoldReleaseControls";
import {buildStaffModuleHref} from "./staff-modules";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/** One explicit current accepted quote's temporary hold. Display hints are not
 * authority: the server action independently double-reads the saved source,
 * checks membership and status, then verifies the saved release. */
export async function OwnerQuoteHoldReleasePanel({workspaceSlug,selectedQuoteId}:{
 workspaceSlug:string;selectedQuoteId?:string;
}){
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||
    workspaceSlug.length>40||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)||
    !selectedQuoteId||!uuid.test(selectedQuoteId))return null;
 if(operationalDatabaseMode()!=="SERVICE_ROLE"||
    process.env.SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED!=="true")return null;
 const snapshot=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!snapshot.ok||snapshot.value.workspace.slug!==workspaceSlug||
    snapshot.value.actor.role!=="OWNER"||
    snapshot.value.actor.workspaceId!==snapshot.value.workspace.id||
    snapshot.value.branchScope?.mode!=="ALL")return null;
 const s=snapshot.value,scope=s.branchScope;
 if(!scope||scope.mode!=="ALL")return null;
 const requests=new Map(s.requests.filter(r=>r.branchId&&
   scope.branches.some(b=>b.id===r.branchId)).map(r=>[r.id,r]));
 const ambiguous=indexAmbiguousCurrentQuoteRequests(s.quotes);
 const current=indexCurrentQuoteByRequest(s.quotes);
 const q=s.quotes.find(q=>q.id===selectedQuoteId);
 if(!q||q.status!=="ACCEPTED"||!requests.has(q.requestId)||
    ambiguous.has(q.requestId)||current.get(q.requestId)?.id!==q.id)return null;
 const now=Date.parse(s.loadedAt);
 if(!Number.isFinite(now))return null;
 const active=s.slotHolds.filter(h=>h.quoteId===selectedQuoteId&&
   h.status==="HELD"&&Number.isFinite(Date.parse(h.expiresAt))&&
   Date.parse(h.expiresAt)>now);
 if(active.length===0)return null;
 const href=buildStaffModuleHref(workspaceSlug,"schedule");
 return <section className="app-panel" aria-label="Owner temporary hold release"
   data-testid="f23-hold-release-panel">
  <h2>Release an unused held slot</h2>
  {active.length!==1?<p role="alert">Multiple saved active holds were found for
    this accepted quote. Do not release an ambiguous hold. <Link href={href}>
      Review the source in Schedule</Link>.</p>:
   <OwnerSavedHoldReleaseControls workspaceSlug={workspaceSlug} quoteId={q.id}
     holdId={active[0].id} expiresAt={active[0].expiresAt}/>}
 </section>;
}
