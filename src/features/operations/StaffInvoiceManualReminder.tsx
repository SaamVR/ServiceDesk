"use client";

import { useEffect, useRef, useState } from "react";
import {
  verifiedStaffInvoiceReminder, staffInvoiceReminderScopeKey,
  type StaffInvoiceReminderFacts,
} from "./staff-invoice-manual-reminder";

/** Staff-controlled clipboard handoff. No provider API, outbox or customer
 * address is accessible here and copying does not mark an invoice delivered.
 */
export function StaffInvoiceManualReminder({
  invoice,
}: { invoice: StaffInvoiceReminderFacts }) {
  // Force a clean editing/confirmation state whenever the authoritative
  // financial facts change, even while the invoice UUID remains unchanged.
  return <ScopedStaffInvoiceManualReminder key={staffInvoiceReminderScopeKey(invoice)} invoice={invoice} />;
}
function ScopedStaffInvoiceManualReminder({ invoice }: { invoice: StaffInvoiceReminderFacts }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle"|"copied"|"manual"|"invalid">("idle");
  const [copying, setCopying] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function copy() {
    if (pending.current || !reviewConfirmed) return;
    pending.current = true;
    setCopying(true);
    try {
      const text = typeof window !== "undefined"
        ? verifiedStaffInvoiceReminder(invoice,window.location.origin) : null;
      if (!text) {
        setMessage("");
        setStatus("invalid");
        return;
      }
      setMessage(text);
      if (!window.isSecureContext || !navigator.clipboard?.writeText) {
        setStatus("manual");
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        if (mounted.current) setStatus("copied");
      } catch {
        if (mounted.current) setStatus("manual");
      }
    } finally {
      pending.current = false;
      if (mounted.current) setCopying(false);
    }
  }

  return <section aria-label="Customer invoice manual follow-up"
    style={{ background:"#f5faf8", border:"1px solid #d4e8e0",
      borderRadius:10, padding:14, display:"grid", gap:9 }}>
    <strong>Verified invoice follow-up · manual only</strong>
    <p style={{ margin:0,fontSize:".82rem",lineHeight:1.5 }}>
      Staff must verify the recipient and share this secure sign-in link using
      an approved contact channel. Copying a reminder does not queue or send
      a message, prove delivery or collect any payment. Balances can change;
      recheck the saved invoice immediately before using any copied text.
    </p>
    <label style={{display:"flex",alignItems:"flex-start",gap:9,fontSize:".83rem",lineHeight:1.6}}>
      <input type="checkbox" checked={reviewConfirmed} disabled={copying}
        onChange={event=>setReviewConfirmed(event.target.checked)}
        style={{height:20,width:20,flex:"0 0 20px",marginTop:2}} />
      <span>I verified the saved invoice, accepted quote and current balance,
        and will independently confirm the correct recipient and authorized
        contact channel before sharing any copied message.</span>
    </label>
    <button type="button" onClick={copy} disabled={copying || !reviewConfirmed} aria-busy={copying}
      style={{ minHeight:44, justifySelf:"start",
      background:"#194f44",color:"#fff",padding:"9px 13px",
      border:0,borderRadius:7,cursor:"pointer" }}>
      {copying ? "Copying verified reminder…" : "Copy reviewed invoice reminder"}
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
