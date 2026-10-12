"use client";

import { useState } from "react";
import styles from "./AiOwnerModelProbe.module.css";

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
  // A model probe proves only a single owner-controlled request.
  // Never display another workspace's response after client-side navigation.
  const [status, setStatus] = useState<{
    workspace: string; busy: boolean; result?: ProbeResult; error?: boolean;
  }>();
  const scoped = status?.workspace === workspaceSlug ? status : undefined;
  const busy = scoped?.busy ?? false;
  const result = scoped?.result;
  const error = scoped?.error ?? false;

  async function check() {
    if (!configured || busy) return;
    const submittedWorkspace = workspaceSlug;
    setStatus({ workspace: submittedWorkspace, busy: true });
    let verified: ProbeResult | undefined;
    let failed = false;
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
          typeof candidate.model !== "string" || !candidate.model.trim() ||
          typeof candidate.checkedAt !== "string" ||
          !Number.isFinite(Date.parse(candidate.checkedAt))) {
        throw Error("INVALID_PROBE");
      }
      verified = candidate;
    } catch {
      failed = true;
    } finally {
      setStatus(previous => previous?.workspace === submittedWorkspace
        ? { workspace: submittedWorkspace, busy: false, result: verified, error: failed }
        : previous);
    }
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
        Run one synthetic, non-customer check of the configured AI model. No customer messages are sent,
        no business records change, and this does not verify WhatsApp, email or automation delivery.
      </p>
      <button type="button" className={styles.action} disabled={!configured || busy}
        onClick={check} aria-busy={busy}>
        {busy ? "Testing model…" : "Test AI model connection"}
      </button>
      {!configured ? (
        <p role="status" className={`${styles.message} ${styles.note}`}>
          AI is not enabled for this workspace environment. Configure the server-only model and
          API key before attempting an owner-initiated test.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={`${styles.message} ${styles.error}`}>
          The model did not return a verified response. Check protected server configuration
          and provider authorization; no request or customer record was changed.
        </p>
      ) : null}
      {result ? (
        <p role="status" className={`${styles.message} ${styles.success}`}>
          Model response confirmed for this session: <strong>{result.model}</strong> ·{" "}
          <time dateTime={result.checkedAt}>{result.checkedAt}</time>.
          <span className={styles.secondary}>This is an ephemeral connection test, not a durable
            provider delivery or workflow-execution receipt.</span>
        </p>
      ) : null}
    </section>
  );
}
