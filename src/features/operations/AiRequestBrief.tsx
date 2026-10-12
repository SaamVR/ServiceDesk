"use client";

import { useEffect, useRef, useState } from "react";
import { parseSavedAiRequestBrief, type SavedAiRequestBrief } from "./ai-request-brief-contract";
import styles from "./AiRequestBrief.module.css";

type Brief = SavedAiRequestBrief;

export function AiRequestBrief({
  workspaceSlug, requestId, configured,
}: {
  workspaceSlug: string;
  requestId: string;
  configured: boolean;
}) {
  // React can reuse this panel as the operator switches requests or tenants.
  // Previous asynchronous results must never appear under a different scope.
  const scopeKey = workspaceSlug + "\\0" + requestId + "\\0" +
    (configured ? "configured" : "disabled");
  const [status, setStatus] = useState<{
    scopeKey: string; busy: boolean; brief?: Brief; error?: string;
  }>();
  const scoped = status?.scopeKey === scopeKey ? status : undefined;
  const busy = scoped?.busy ?? false;
  const pendingRequest = useRef<AbortController | null>(null);
  // A completed model request for a previous tenant or customer request
  // must never hydrate the current panel. Abort expensive obsolete requests
  // on scope change/unmount in addition to the existing state scope guard.
  useEffect(() => {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    return () => pendingRequest.current?.abort();
  }, [scopeKey]);
  const brief = scoped?.brief;
  const error = scoped?.error;

  async function generate() {
    if (!configured || busy) return;
    pendingRequest.current?.abort();
    const request = new AbortController();
    pendingRequest.current = request;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      request.abort();
    }, 20_000);
    const submittedScope = scopeKey;
    setStatus({ scopeKey: submittedScope, busy: true });
    let verifiedBrief: Brief | undefined;
    let message: string | undefined;
    try {
      const response = await fetch("/api/internal/ai/request-brief", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ workspaceSlug, requestId }),
        signal: request.signal,
      });
      if (!response.ok ||
          !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        message = "AI couldn't prepare a verified request brief. Use the saved request details instead.";
      } else {
        const result: unknown = await response.json();
        const parsed = parseSavedAiRequestBrief(result, requestId);
        if (!parsed) {
          message = "AI couldn't prepare a verified request brief. Use the saved request details instead.";
        } else {
          verifiedBrief = parsed;
        }
      }
    } catch {
      if (timedOut) {
        message = "The AI request timed out. Retry when ready; no saved customer data was changed.";
      } else if (!request.signal.aborted) {
        message = "The AI connection couldn't be reached. No request or customer record was changed.";
      }
    } finally {
      clearTimeout(timeout);
      if (pendingRequest.current === request) pendingRequest.current = null;
      if (!request.signal.aborted || timedOut) {
        setStatus(previous => previous?.scopeKey === submittedScope
          ? { scopeKey: submittedScope, busy: false, brief: verifiedBrief, error: message }
          : previous);
      }
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
