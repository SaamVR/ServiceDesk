"use client";

import { useState } from "react";
import {
  verifiedStaffInvoiceReminder,
  type StaffInvoiceReminderFacts,
} from "./staff-invoice-manual-reminder";

/** Staff-controlled clipboard handoff. No provider API, outbox or customer
 * address is accessible here and copying does not mark an invoice delivered.
 */
export function StaffInvoiceManualReminder({
  invoice,
}: { invoice: StaffInvoiceReminderFacts }) {
  return <ScopedStaffInvoiceManualReminder key={invoice.id} invoice={invoice} />;
}
function ScopedStaffInvoiceManualReminder({ invoice }: { invoice: StaffInvoiceReminderFacts }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle"|"copied"|"manual"|"invalid">("idle");

  async function copy() {
    const text = typeof window !== "undefined"
      ? verifiedStaffInvoiceReminder(invoice,window.location.origin) : null;
    if (!text) {
      setMessage("");
      setStatus("invalid");
      return;
    }
    setMessage(text);
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText) {
        setStatus("manual");
        return;
      }
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch { setStatus("manual"); }
  }

  return <section aria-label="Customer invoice manual follow-up"
    style={{ background:"#f5faf8", border:"1px solid #d4e8e0",
      borderRadius:10, padding:14, display:"grid", gap:9 }}>
    <strong>Verified invoice follow-up · manual only</strong>
    <p style={{ margin:0,fontSize:".82rem",lineHeight:1.5 }}>
      Staff must verify the recipient and share this secure sign-in link using
      an approved contact channel. Copying a reminder does not queue or send
      a message, prove delivery or collect any payment.
    </p>
    <button type="button" onClick={copy} style={{ justifySelf:"start",
      background:"#194f44",color:"#fff",padding:"9px 13px",
      border:0,borderRadius:7,cursor:"pointer" }}>
      Copy verified invoice reminder
    </button>
    {message ? <label style={{display:"grid",gap:4,fontSize:".8rem"}}>
      Human-reviewed reminder
      <textarea readOnly value={message} rows={7} onFocus={e=>e.currentTarget.select()}
        aria-label="Saved invoice reminder text"
        style={{width:"100%",padding:9,border:"1px solid #b5d5ca",borderRadius:6}} />
    </label> : null}
    {status!=="idle" ? <p role="status" style={{margin:0,fontSize:".82rem"}}>
      {status==="copied"
        ? "Reminder copied. Staff must review, address and send it manually; no delivery receipt exists."
        : status==="manual"
          ? "Clipboard unavailable. Select and manually copy the verified reminder. Nothing was sent."
          : "The linked accepted quote or invoice ledger could not be verified. Review the invoice before sharing."}
    </p> : null}
  </section>;
}
