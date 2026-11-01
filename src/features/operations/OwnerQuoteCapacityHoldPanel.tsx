import Link from "next/link";
import {loadOperationalStaffSnapshot} from "./operational-product-runtime";
import {operationalDatabaseMode} from "@/features/auth/operational-preview-mode";
import {indexCurrentQuoteByRequest,indexAmbiguousCurrentQuoteRequests} from "./staff-snapshot-index";
import {VerifiedQuoteSlotHoldControls} from "./VerifiedQuoteSlotHoldControls";
import {buildStaffModuleHref} from "./staff-modules";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/**
 * Only the owner of the saved accepted quote sees candidate capacity.
 * Snapshot is a hint; every action re-reads the source and final saved hold.
 */
export async function OwnerQuoteCapacityHoldPanel({workspaceSlug,selectedQuoteId}:{
 workspaceSlug:string;selectedQuoteId?:string;
}){
 if(typeof workspaceSlug!=="string"||workspaceSlug.length<3||workspaceSlug.length>40||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))return null;
 const loaded=await loadOperationalStaffSnapshot(workspaceSlug);
 if(!loaded.ok||loaded.value.workspace.slug!==workspaceSlug||
    loaded.value.actor.role!=="OWNER"||
    loaded.value.actor.workspaceId!==loaded.value.workspace.id||
    loaded.value.branchScope.mode!=="ALL"||
    operationalDatabaseMode()!=="SERVICE_ROLE")return null;
 const data=loaded.value;
 const requests=new Map(data.requests.filter(r=>typeof r.branchId==="string"&&
    data.branchScope.branches.some(b=>b.id===r.branchId)).map(r=>[r.id,r]));
 const ambiguous=indexAmbiguousCurrentQuoteRequests(data.quotes);
 const current=indexCurrentQuoteByRequest(data.quotes);
 const accepted=data.quotes.filter(q=>q.status==="ACCEPTED"&&
    requests.has(q.requestId)&&!ambiguous.has(q.requestId)&&
    current.get(q.requestId)?.id===q.id);
 const href=buildStaffModuleHref(workspaceSlug,"quotes");
 if(!selectedQuoteId||!uuid.test(selectedQuoteId))return accepted.length?
  <section className="app-panel" aria-label="Choose accepted quote to hold capacity">
   <h2>Accepted quote → capacity hold</h2>
   <p>Select an accepted saved quote. This prepares a temporary slot hold, not a confirmed booking.</p>
   <ul>{accepted.slice(0,12).map((q,i)=><li key={q.id}>
    <Link href={href+"?quote="+encodeURIComponent(q.id)}>
     Accepted quote {i+1} · revision {q.version}</Link></li>)}</ul>
  </section>:null;
 const quote=accepted.find(q=>q.id===selectedQuoteId);
 if(!quote)return <section className="app-panel" aria-label="Accepted quote capacity unavailable">
  <h2>Quote capacity review unavailable</h2>
  <p>This quote is not a verified current accepted offer in your saved branch scope.
   Open the authoritative saved quote and review acceptance before scheduling.</p>
 </section>;
 const request=requests.get(quote.requestId);
 if(!request?.branchId)return null;
 const alreadyVisited=data.visits.some(v=>v.quoteId===quote.id&&v.status!=="CANCELLED");
 const now=Date.now();
 const activeHold=data.slotHolds.some(h=>h.quoteId===quote.id&&
  (h.status==="CONFIRMED"||h.status==="HELD"&&Date.parse(h.expiresAt)>now));
 const crewIds=new Set(data.crews.filter(c=>c.active&&c.branchId===request.branchId).map(c=>c.id));
 const required=quote.durationMinutes+quote.bufferMinutes;
 const candidates=(!alreadyVisited&&!activeHold&&Number.isSafeInteger(required)&&required>0?
  data.capacitySlots.filter(c=>crewIds.has(c.crewId)&&
   Number.isSafeInteger(c.capacityMinutes)&&c.capacityMinutes>=required&&
   Date.parse(c.startAt)>now&&
   (Date.parse(c.endAt)-Date.parse(c.startAt))/60000>=required&&
   !data.slotHolds.some(h=>h.slotId===c.id&&
    (h.status==="CONFIRMED"||h.status==="HELD"&&Date.parse(h.expiresAt)>now)))
  .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)).slice(0,8).map(c=>({
   slotId:c.id,startAt:c.startAt,endAt:c.endAt,
  })):[]);
 return <section className="app-panel" data-testid="f22-quote-capacity-panel"
  aria-label="Owner accepted quote capacity">
  <h2>Accepted quote → temporary capacity hold</h2>
  <p>Selected quote revision {quote.version}. Only matching active branch crew slots are proposed.
   Saved capacity data may change before you click.</p>
  {alreadyVisited||activeHold?<p role="status">
   A saved visit or active hold already exists for this quote. Continue in{" "}
   <Link href={buildStaffModuleHref(workspaceSlug,"schedule")}>Schedule</Link>;
   no new hold is offered.</p>:
   <VerifiedQuoteSlotHoldControls workspaceSlug={workspaceSlug} quoteId={quote.id}
    candidates={candidates}/>}
 </section>;
}
