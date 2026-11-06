import Link from "next/link";
import {loadOwnerSavedBookingReceipt} from "@/server/ai/owner-saved-booking-receipt";
import {buildStaffModuleHref} from "./staff-modules";
import {OwnerVerifiedBookingDispatchControls} from "./OwnerVerifiedBookingDispatchControls";
/**
 * Source-only owner receipt. A temporary hold, provider intent, invoice
 * balance or isolated SCHEDULED row can never independently trigger it.
 * The server requires a verified APPLIED deposit + matching saved visit.
 */
export async function OwnerSavedBookingReceiptPanel({workspaceSlug,selectedQuoteId}:{
 workspaceSlug:string;selectedQuoteId?:string;
}){
 if(!selectedQuoteId||typeof selectedQuoteId!=="string"||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(selectedQuoteId))return null;
 const checked=await loadOwnerSavedBookingReceipt(workspaceSlug,selectedQuoteId);
 if(!checked.ok)return null;
 const v=checked.value;
 return <section className="app-panel" aria-label="Verified saved visit and deposit record"
  data-testid="f25-saved-booking-receipt">
  <h2>Saved booking evidence · owner review</h2>
  <p><strong>A scheduled visit and applied deposit are recorded.</strong>
   This is a database readback, not a new payment or confirmation action.</p>
  <p>Quote revision {v.quoteVersion} · visit status {v.visitStatus}
   {" "}· invoice status {v.invoiceStatus}</p>
  <p>Saved visit start: {new Date(v.startsAt).toUTCString()}.
   Visit and invoice identifiers were reconciled to the selected accepted quote.</p>
  <p>The saved deposit application, confirmed hold, scheduled visit and invoice
   match. No customer message or payment was triggered by this review.
   Check with the payment provider independently when required.</p>
  {v.visitStatus==="SCHEDULED"&&
    process.env.SERVICEDESK_F26_OWNER_DISPATCH_ENABLED==="true"?
     <OwnerVerifiedBookingDispatchControls workspaceSlug={workspaceSlug}
       quoteId={v.quoteId} visitId={v.visitId}/>:null}
  <p><Link href={buildStaffModuleHref(workspaceSlug,"schedule")}>
   Open saved visit in Schedule</Link>{" · "}
   <Link href={buildStaffModuleHref(workspaceSlug,"invoices")}>
   Review saved invoice</Link></p>
 </section>;
}
