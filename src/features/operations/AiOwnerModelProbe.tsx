"use client";

import { useEffect, useRef, useState } from "react";
import {
  describeOwnerModelProbeFailure,
  parseOwnerModelProbe,
  type VerifiedOwnerModelProbe,
} from "./ai-owner-model-probe-result";
import styles from "./AiOwnerModelProbe.module.css";

// Server-side private gateway may use up to 60s after measured 25s inference.
// Allow 15s for HTTP/proxy overhead; UI abort is not provider cancellation.
const MODEL_PROBE_TIMEOUT_MS = 75_000;

/**
 * Owner-only, synthetic model diagnostic. A successful response proves only
 * one bounded request; it never proves automation, delivery or business action.
 */
export function AiOwnerModelProbe(props: {
  workspaceSlug: string;
  configured: boolean;
}) {
  // Scope remount prevents a previous cost acknowledgement from becoming
  // valid again after switching workspace A -> B -> A.
  return <ScopedAiOwnerModelProbe key={props.workspaceSlug + ":" + String(props.configured)}
    {...props} />;
}
function ScopedAiOwnerModelProbe({
  workspaceSlug, configured,
}: {
  workspaceSlug: string;
  configured: boolean;
}) {
  const activeRequest = useRef<AbortController | null>(null);
  const scopeKey = workspaceSlug + "\\0" + (configured ? "configured" : "disabled");
  const [approvedScope,setApprovedScope] = useState<string|null>(null);
  const operatorApproved = approvedScope === scopeKey;
  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, [scopeKey]);

  const [status, setStatus] = useState<{
    scopeKey: string;
    busy: boolean;
    result?: VerifiedOwnerModelProbe;
    error?: string;
  }>();
  const scoped = status?.scopeKey === scopeKey ? status : undefined;
  const busy = scoped?.busy ?? false;
  const result = scoped?.result;
  const error = scoped?.error;

  async function check() {
    // A synthetic model call can incur usage; one explicit acknowledgment
    // is needed for EACH deliberate owner diagnostic invocation.
    if (!configured || !operatorApproved || busy || activeRequest.current) return;
    setApprovedScope(null);
    const requestedWorkspace = workspaceSlug;
    const submittedScope = scopeKey;
    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus({ scopeKey: submittedScope, busy: true });
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
      // Transport abort alone cannot guarantee a fetch/JSON promise settles.
      // Explicitly close this synthetic owner test at the 75s deadline.
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setStatus(previous => previous?.scopeKey === submittedScope && previous.busy
          ? { scopeKey: submittedScope, busy: false,
              error: "The model test exceeded 75 seconds. This browser stopped waiting; provider-side completion is not verified." }
          : previous);
      }
    }, MODEL_PROBE_TIMEOUT_MS);

    let verified: VerifiedOwnerModelProbe | undefined;
    let failure: string | undefined;
    try {
      const response = await fetch("/api/internal/ai/connection-test", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ workspaceSlug: requestedWorkspace }),
      });
      if (!response.ok) {
        failure = describeOwnerModelProbeFailure(response.status);
      } else if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        failure = "The AI endpoint did not return a verifiable JSON diagnostic response.";
      } else {
        const payload: unknown = await response.json();
        verified = parseOwnerModelProbe(payload) ?? undefined;
        if (!verified) failure = "The AI endpoint returned an invalid or incomplete diagnostic receipt.";
      }
    } catch {
      failure = didTimeout
        ? "The model test exceeded 75 seconds. This browser stopped waiting; provider-side completion is not verified."
        : "The model could not be reached or the response was invalid. No customer action was authorized.";
    } finally {
      clearTimeout(timeout);
      // A buffered JSON response can still resolve after AbortController
      // fires. A timed-out/aborted call must never become a success receipt.
      if (controller.signal.aborted) {
        verified = undefined;
        if (didTimeout) failure =
          "The model test exceeded 75 seconds. This browser stopped waiting; provider-side completion is not verified.";
      }
      // Cancellation, unmount or tenant changes must not restore old results.
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setStatus(previous => previous?.scopeKey === submittedScope && previous.busy
          ? { scopeKey: submittedScope, busy: false, result: verified, error: failure }
          : previous);
      }
    }
  }

  function cancel() {
    if (!busy || !activeRequest.current) return;
    const request = activeRequest.current;
    activeRequest.current = null;
    request.abort();
    setStatus(previous => previous?.scopeKey === scopeKey
      ? { scopeKey, busy: false,
          error: "Stopped waiting for the model test. Browser cancellation is not proof of provider-side cancellation." }
      : previous);
  }

  return (
    <section aria-label="Owner AI model connection test" className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Configuration diagnostic</p>
          <h3 className={styles.title}>AI model connection</h3>
        </div>
        <span className={`${styles.state} ${configured ? styles.available : styles.disabled}`}>
          {configured ? "Configured · unverified" : "Setup required"}
        </span>
      </div>
      <p className={styles.description}>
        Run one bounded synthetic check of the configured AI model. No customer messages
        are sent and no business records change. This does not verify WhatsApp, email or automation delivery.
        Quote approvals are independently authorized.
      </p>
      <label className={styles.consent}>
        <input type="checkbox" checked={operatorApproved} disabled={!configured || busy}
          onChange={event=>setApprovedScope(event.target.checked ? scopeKey : null)} />
        <span>I authorize one synthetic call to the configured model.
          It can consume tokens or incur provider usage; it is not a
          provider-delivery or AI automation acceptance test.</span>
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={!configured || !operatorApproved || busy}
          onClick={check} aria-busy={busy}>
          {busy ? "Testing model connection…" : "Test AI model connection"}
        </button>
        {busy ? <button type="button" className={styles.cancel} onClick={cancel}>
          Stop waiting
        </button> : null}
      </div>
      {!configured ? (
        <p role="status" className={`${styles.message} ${styles.note}`}>
          AI is not enabled for this workspace environment. Configure the private model
          and API key on the server before attempting an owner-initiated test.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={`${styles.message} ${styles.error}`}>{error}</p>
      ) : null}
      {result ? (
        <p role="status" className={`${styles.message} ${styles.success}`}>
          Model response confirmed for this session: <strong>{result.model}</strong> ·{" "}
          <time dateTime={result.checkedAt}>{result.checkedAt}</time>.
          <span className={styles.secondary}>This is an ephemeral connection test,
            not a durable AI execution or customer-delivery receipt.</span>
        </p>
      ) : null}
    </section>
  );
}
