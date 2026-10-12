"use client";

import { useState } from "react";
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
  // React can reuse this panel as the operator switches requests or tenants.
  // Previous asynchronous results must never appear under a different scope.
  const scopeKey = workspaceSlug + "\\0" + requestId;
  const [status, setStatus] = useState<{
    scopeKey: string; busy: boolean; brief?: Brief; error?: string;
  }>();
  const scoped = status?.scopeKey === scopeKey ? status : undefined;
  const busy = scoped?.busy ?? false;
  const brief = scoped?.brief;
  const error = scoped?.error;

  async function generate() {
    if (!configured || busy) return;
    const submittedScope = scopeKey;
    setStatus({ scopeKey: submittedScope, busy: true });
    let verifiedBrief: Brief | undefined;
    let message: string | undefined;
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
          typeof (result as Brief).model !== "string" ||
          !(result as Brief).model.trim() ||
          typeof (result as Brief).briefing !== "string" ||
          !(result as Brief).briefing.trim() ||
          (result as Brief).briefing.length > 900) {
        message = "AI couldn't prepare a verified request brief. Use the saved request details instead.";
      } else {
        verifiedBrief = result as Brief;
      }
    } catch {
      message = "The AI connection couldn't be reached. No request or customer record was changed.";
    } finally {
      setStatus(previous => previous?.scopeKey === submittedScope
        ? { scopeKey: submittedScope, busy: false, brief: verifiedBrief, error: message }
        : previous);
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
