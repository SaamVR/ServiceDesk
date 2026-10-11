"use client";

import { useEffect, useState } from "react";
import styles from "./AiRequestBrief.module.css";

type Brief = {
  state: "AI_DRAFT_REQUIRES_REVIEW";
  requestId: string;
  model: string;
  briefing: string;
  source: "AUTHORIZED_SAVED_REQUEST";
};

export function AiRequestBrief({
  workspaceSlug, requestId, configured,
}: {
  workspaceSlug: string;
  requestId: string;
  configured: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<Brief>();
  const [error, setError] = useState<string>();

  useEffect(() => { setBrief(undefined); setError(undefined); }, [requestId, workspaceSlug]);

  async function generate() {
    if (!configured || busy) return;
    setBusy(true);
    setError(undefined);
    setBrief(undefined);
    try {
      const response = await fetch("/api/internal/ai/request-brief", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceSlug, requestId }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" ||
          (result as Brief).state !== "AI_DRAFT_REQUIRES_REVIEW" ||
          (result as Brief).source !== "AUTHORIZED_SAVED_REQUEST" ||
          (result as Brief).requestId !== requestId ||
          typeof (result as Brief).briefing !== "string" ||
          !(result as Brief).briefing.trim() ||
          (result as Brief).briefing.length > 900) {
        setError("AI couldn't prepare a verified request brief. Use the saved request details instead.");
        return;
      }
      setBrief(result as Brief);
    } catch {
      setError("The AI connection couldn't be reached. No request or customer record was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-label="AI request copilot">
      <div className={styles.top}>
        <div>
          <span className={styles.eyebrow}>AI + human review</span>
          <h3>Request copilot</h3>
          <p>Analyze this saved cleaning enquiry and suggest missing intake questions.</p>
        </div>
        <span className={configured ? styles.ready : styles.offline}>
          {configured ? "AI configured" : "Setup required"}
        </span>
      </div>
      {configured ? (
        <>
          <button className={styles.action} type="button" onClick={generate} disabled={busy} aria-busy={busy}>
            {busy ? "Preparing AI briefing…" : "Generate AI intake brief"}
          </button>
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          {brief ? (
            <div className={styles.result} role="status" aria-live="polite">
              <strong>AI-generated draft · review required</strong>
              <p className={styles.draft}>{brief.briefing}</p>
              <span>Generated using {brief.model}. Staff must verify facts before any quote, booking or communication.</span>
            </div>
          ) : null}
        </>
      ) : (
        <p className={styles.explanation}>
          AI is not activated for this environment. An administrator must configure the server-only model,
          API key and explicit AI enablement. The underlying request and manual quoting remain available.
        </p>
      )}
      <p className={styles.footer}>No customer contacts or addresses are sent to the model. No prices, bookings, messages or payments are changed.</p>
    </section>
  );
}
