"use client";

import { useState } from "react";

interface ProbeResult {
  state: "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE";
  model: string;
  checkedAt: string;
  source: "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY";
  durableReceipt: false;
}

/** Explicit owner click; a successful test verifies only this one model call. */
export function AiOwnerModelProbe({
  workspaceSlug, configured,
}: {
  workspaceSlug: string;
  configured: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProbeResult>();
  const [error, setError] = useState(false);

  async function check() {
    if (!configured || busy) return;
    setBusy(true);
    setResult(undefined);
    setError(false);
    try {
      const response = await fetch("/api/internal/ai/connection-test", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceSlug }),
      });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== "object") throw Error("PROBE_FAILED");
      const candidate = data as ProbeResult;
      if (candidate.state !== "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE" ||
          candidate.source !== "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY" ||
          candidate.durableReceipt !== false ||
          typeof candidate.model !== "string" || !candidate.model ||
          typeof candidate.checkedAt !== "string") {
        throw Error("INVALID_PROBE");
      }
      setResult(candidate);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Owner AI model connection test" style={{
      display: "grid", gap: 10, border: "1px solid #d1e8df", borderRadius: 12,
      background: "#fff", padding: 16,
    }}>
      <strong style={{ color: "#244b41", fontSize: ".87rem" }}>Model connection diagnostic</strong>
      <p style={{ color: "#57756b", fontSize: ".79rem", margin: 0, lineHeight: 1.6 }}>
        Send one synthetic, non-customer probe to the configured AI model. No messages are sent,
        no business records change, and this does not verify email, WhatsApp or automation delivery.
      </p>
      <button type="button" disabled={!configured || busy} onClick={check}
        aria-busy={busy}
        style={{
          background: configured ? "#166b5e" : "#e3ebe7",
          color: configured ? "#fff" : "#52645b",
          border: 0, borderRadius: 9, padding: "11px 14px", minHeight: 42,
          justifySelf: "start", cursor: configured ? "pointer" : "not-allowed",
          fontSize: ".82rem", fontWeight: 750,
        }}>
        {busy ? "Testing model…" : "Test AI model connection"}
      </button>
      {!configured ? <p role="status" style={{ margin: 0, color: "#80632c", fontSize: ".78rem" }}>
        Not available: enable AI with server-only model credentials in the protected environment.
      </p> : null}
      {error ? <p role="alert" style={{ color: "#9a3b47", margin: 0, fontSize: ".8rem" }}>
        No verified model response. Check server-only model setup, provider authorization and logs.
      </p> : null}
      {result ? <p role="status" style={{ color: "#145f4f", margin: 0, fontSize: ".8rem" }}>
        Model response confirmed in this session: {result.model} · {result.checkedAt}.
        This is an ephemeral connection test, not a durable provider or workflow receipt.
      </p> : null}
    </section>
  );
}
