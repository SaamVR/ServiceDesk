"use client";

import { useState } from "react";

/** Explicit human handoff; copying a link does not prove provider delivery. */
export function QuoteCustomerHandoff({ quoteId }: { quoteId: string }) {
  const path = "/portal/quotes/" + encodeURIComponent(quoteId);
  const [result, setResult] = useState<"idle" | "copied" | "manual">("idle");

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
      {result !== "idle" ? (
        <p role="status" aria-live="polite" style={{ margin: 0, fontSize: ".8rem" }}>
          {result === "copied"
            ? "Link copied. This is not a delivery receipt."
            : "Clipboard unavailable. Select and copy the path above; customers must sign in."}
        </p>
      ) : null}
    </section>
  );
}
