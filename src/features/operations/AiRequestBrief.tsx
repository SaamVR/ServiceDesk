"use client";

import { useEffect, useRef, useState } from "react";
import { parseSavedAiRequestBrief, type SavedAiRequestBrief } from "./ai-request-brief-contract";
import { describeAiRequestBriefFailure } from "./ai-request-brief-failure";
import styles from "./AiRequestBrief.module.css";

// The private gateway may use its full 60s server-side model budget after
// measured 25s inference. Leave 15s for network/proxy overhead; a browser
// abort cannot certify upstream cancellation or zero usage cost.
const REQUEST_BRIEF_WAIT_LIMIT_MS = 75_000;
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
    }, REQUEST_BRIEF_WAIT_LIMIT_MS);
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
      const isJson = response.headers.get("content-type")?.toLowerCase().includes("application/json");
      if (!response.ok) {
        // The protected endpoint returns only stable machine codes. Translate
        // known codes into useful operator guidance; never render a provider's
        // arbitrary error string, prompt or customer metadata.
        let failureCode: unknown;
        if (isJson) {
          try {
            const failure: unknown = await response.json();
            if (failure && typeof failure === "object" && !Array.isArray(failure) &&
                Object.keys(failure).length <= 3) {
              failureCode = (failure as { code?: unknown }).code;
            }
          } catch { /* Non-JSON/malformed response uses safe HTTP fallback. */ }
        }
        message = describeAiRequestBriefFailure(failureCode, response.status);
      } else if (!isJson) {
        message = describeAiRequestBriefFailure(undefined);
      } else {
        const result: unknown = await response.json();
        const parsed = parseSavedAiRequestBrief(result, requestId);
        if (!parsed) {
          message = describeAiRequestBriefFailure("AI_MODEL_INVALID_RESPONSE");
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
      // A buffered JSON response may resolve after the timer aborts. Never
      // show that stale draft as a valid AI result after a timed-out request.
      if (request.signal.aborted) {
        verifiedBrief = undefined;
        if (timedOut) message =
          "The AI request exceeded 75 seconds. The browser stopped waiting; provider-side cancellation is not confirmed. Saved customer data was not changed by this briefing.";
      }
      if (pendingRequest.current === request) pendingRequest.current = null;
      if (!request.signal.aborted || timedOut) {
        setStatus(previous => previous?.scopeKey === submittedScope
          ? { scopeKey: submittedScope, busy: false, brief: verifiedBrief, error: message }
          : previous);
      }
    }
  }

  function cancelBrief() {
    const pending = pendingRequest.current;
    if (!pending || !busy) return;
    // Abort the browser HTTP request and ask the server to propagate it.
    // Do not promise that the upstream provider stopped or incurred no cost.
    pending.abort();
    pendingRequest.current = null;
    setStatus(previous => previous?.scopeKey === scopeKey
      ? { scopeKey, busy: false,
          error: "Stopped waiting for AI briefing. Provider-side cancellation is not confirmed. Saved requests, quotes and customer records are unchanged." }
      : previous);
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
          <div className={styles.actionRow}>
            <button className={styles.action} type="button" onClick={generate} disabled={busy} aria-busy={busy}>
              {busy ? "Preparing AI briefing…" : "Generate AI intake brief"}
            </button>
            {busy ? (
              <button className={styles.cancelAction} type="button" onClick={cancelBrief}
                aria-label="Cancel AI request briefing">
                Cancel AI briefing
              </button>
            ) : null}
          </div>
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
