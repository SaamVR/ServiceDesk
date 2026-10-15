"use client";

import { useState } from "react";
import { verifiedManualQuoteHandoffMessage, type ManualQuoteHandoffFacts } from "./quote-manual-handoff";
import { getCurrentVerifiedManualQuoteHandoff } from "./current-quote-handoff-action";

/** Explicit human handoff; copying a link does not prove provider delivery. */
export function QuoteCustomerHandoff({ workspaceSlug, quoteId, facts }: { workspaceSlug: string; quoteId: string; facts?: ManualQuoteHandoffFacts }) {
  const path = "/portal/quotes/" + encodeURIComponent(quoteId);
  const [result, setResult] = useState<"idle" | "copied" | "manual" | "summary-copied" | "summary-manual" | "stale">("idle");
  const [manualSummary, setManualSummary] = useState("");

  async function copyCustomerQuoteLink() {
    setResult("idle");
    try {
      if (typeof window === "undefined" || !window.isSecureContext ||
          !window.navigator.clipboard?.writeText) {
        setResult("manual");
        return;
      }
      // Use only the current HTTPS review/product origin, never a customer or
      // staff-supplied redirect host. The portal requires customer sign-in.
      await window.navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setResult("copied");
    } catch {
      setResult("manual");
    }
  }

  async function copyVerifiedQuoteSummary() {
    setResult("idle");
    // Current persisted quote state may have changed after page render.
    // Read again with fresh staff membership and branch scope before any
    // prices reach the clipboard. A stale page is never delivery evidence.
    setManualSummary("");
    if (!facts || typeof window === "undefined") {
      setResult("stale");
      return;
    }
    let draft: string | null = null;
    try {
      const current = await getCurrentVerifiedManualQuoteHandoff(workspaceSlug, quoteId);
      if (current.ok) {
        draft = verifiedManualQuoteHandoffMessage(current.facts, window.location.origin);
      }
    } catch { /* Fail closed; show no stale commercial copy. */ }
    if (!draft) { setResult("stale"); return; }
    setManualSummary(draft);
    try {
      if (!window.isSecureContext || !window.navigator.clipboard?.writeText) {
        setResult("summary-manual");
        return;
      }
      await window.navigator.clipboard.writeText(draft);
      setResult("summary-copied");
    } catch { setResult("summary-manual"); }
  }

  return (
    <section aria-label="Customer quote handoff" style={{
      border: "1px solid #c5e2d9", borderRadius: 12,
      background: "#f5fbf8", padding: 14, display: "grid", gap: 10,
    }}>
      <strong>Manual customer portal handoff</strong>
      <p style={{ margin: 0, fontSize: ".84rem", lineHeight: 1.55 }}>
        This quote is marked SENT in ServiceDesk, but that status does not
        verify WhatsApp or email delivery. Share the customer sign-in link
        through your approved contact channel, and check the provider receipt
        separately before claiming it was delivered.
      </p>
      <label style={{ display: "grid", gap: 5, fontSize: ".8rem" }}>
        Customer sign-in path (no account or contact details in this URL)
        <input type="text" readOnly value={path} aria-label="Customer quote portal path"
          onFocus={e => e.currentTarget.select()}
          style={{ width: "100%", padding: 9, borderRadius: 6,
            border: "1px solid #b4d5cb", background: "#fff" }} />
      </label>
      <button type="button" onClick={copyCustomerQuoteLink}
        style={{ padding: "9px 12px", borderRadius: 8, fontWeight: 600,
          background: "#194f44", color: "white", border: 0, cursor: "pointer" }}>
        Copy authenticated quote link
      </button>
      {facts ? (
        <>
          <button type="button" onClick={copyVerifiedQuoteSummary}
            style={{ padding: "9px 12px", borderRadius: 8, fontWeight: 600,
              color: "#174a43", background: "#e4f3ec",
              border: "1px solid #b4d5cb", cursor: "pointer" }}>
            Copy verified quote summary (manual sharing only)
          </button>
          {manualSummary ? (
            <label style={{ display: "grid", gap: 5, fontSize: ".8rem" }}>
              Human-reviewed quote message
              <textarea readOnly value={manualSummary} rows={8}
                aria-label="Verified manual quote summary"
                onFocus={e => e.currentTarget.select()}
                style={{ width: "100%", padding: 9, borderRadius: 6,
                  border: "1px solid #b4d5cb", background: "#fff" }} />
            </label>
          ) : null}
        </>
      ) : null}
      {result !== "idle" ? (
        <p role="status" aria-live="polite" style={{ margin: 0, fontSize: ".8rem" }}>
          {result === "copied"
            ? "Link copied. This is not a delivery receipt."
            : result === "summary-copied"
              ? "Verified quote draft copied. Staff must check the recipient and send it manually; this is not delivery proof."
              : result === "summary-manual"
                ? "Clipboard unavailable. Review and manually copy the quote message. Nothing was sent."
                : result === "stale"
                  ? "This quote is expired or its saved monetary breakdown is not verifiable. Recalculate the quote before sharing."
                  : "Clipboard unavailable. Select and copy the path above; customers must sign in."}
        </p>
      ) : null}
    </section>
  );
}
