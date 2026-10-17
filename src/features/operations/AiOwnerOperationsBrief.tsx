"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { requestOwnerOperationsBrief } from "./owner-operations-brief-action";
import { parseVerifiedOwnerBrief } from "./owner-operations-brief-proof";
import { buildOwnerPriorityCards } from "./owner-operations-brief-priorities";
import type { VerifiedOwnerBrief } from "./owner-operations-brief-proof";
import { buildStaffModuleHref } from "./staff-modules";
import styles from "./AiOwnerOperationsBrief.module.css";

// Server-approved Codex gateway can run for up to 60s. A 75s UI wait avoids
// dropping otherwise valid owner advisories and is NOT a server-action abort.
const OWNER_BRIEF_WAIT_LIMIT_MS = 75_000;
type Display = {
  scopeKey: string;
  phase: "waiting" | "stopped" | "ready" | "error";
  result?: VerifiedOwnerBrief;
  error?: string;
};

/**
 * Owner-initiated and read-only. Server action independently authorizes the
 * owner, rechecks saved count evidence and rejects ungrounded AI suggestions.
 * The client NEVER treats cancellation of display as cancellation of a paid
 * server-side model request.
 */
export function AiOwnerOperationsBrief({
  workspaceSlug, configured,
}: { workspaceSlug: string; configured: boolean }) {
  return <ScopedOwnerBrief key={workspaceSlug + ":" + String(configured)}
    workspaceSlug={workspaceSlug} configured={configured} />;
}

function ScopedOwnerBrief({
  workspaceSlug, configured,
}: { workspaceSlug: string; configured: boolean }) {
  const scopeKey = workspaceSlug + ":" + String(configured);
  const [display, setDisplay] = useState<Display>();
  const state = display?.scopeKey === scopeKey ? display : undefined;
  const sequence = useRef(0);
  const activeRequest = useRef<{
    id: number;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => () => {
    sequence.current += 1;
    if (activeRequest.current) clearTimeout(activeRequest.current.timeout);
    activeRequest.current = null;
  }, [scopeKey]);

  const waiting = state?.phase === "waiting";
  // A server action cannot be aborted from this component. Block retries
  // while the original request is still outstanding, even after UI timeout.
  const requestOutstanding = waiting || state?.phase === "stopped";
  const priorityCards = state?.result
    ? buildOwnerPriorityCards(state.result.facts) : [];

  async function generateBrief() {
    if (!configured || activeRequest.current || requestOutstanding) return;
    const submittedScope = scopeKey;
    const id = ++sequence.current;
    const timeout = setTimeout(() => {
      if (activeRequest.current?.id !== id || sequence.current !== id) return;
      sequence.current += 1;
      setDisplay({
        scopeKey: submittedScope,
        phase: "stopped",
        error: "This briefing is taking longer than 75 seconds. The display stopped waiting, but the server model request may still be processing. Another request is blocked until it finishes.",
      });
    }, OWNER_BRIEF_WAIT_LIMIT_MS);
    activeRequest.current = { id, timeout };
    setDisplay({ scopeKey: submittedScope, phase: "waiting" });
    try {
      const response: unknown = await requestOwnerOperationsBrief(workspaceSlug);
      if (sequence.current !== id || activeRequest.current?.id !== id) return;
      const verified = parseVerifiedOwnerBrief(response);
      setDisplay(verified
        ? { scopeKey: submittedScope, phase: "ready", result: verified }
        : {
            scopeKey: submittedScope,
            phase: "error",
            error: "No verified owner AI briefing is available. Check the saved operational queues manually; no business action was authorized.",
          });
    } catch {
      if (sequence.current !== id || activeRequest.current?.id !== id) return;
      setDisplay({
        scopeKey: submittedScope,
        phase: "error",
        error: "The owner AI briefing was unavailable. Use the saved operational queues; no business action was authorized.",
      });
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current?.id === id) {
        activeRequest.current = null;
        // Do not resurrect a response after the operator stopped waiting.
        // Once the server action settles, enable a new deliberate request.
        if (sequence.current !== id) {
          setDisplay(previous => previous?.scopeKey === submittedScope &&
            previous.phase === "stopped" ? {
              scopeKey: submittedScope,
              phase: "error",
              error: "The prior briefing request has finished. Its result was discarded after you stopped waiting; you can explicitly request a new briefing.",
            } : previous);
        }
      }
    }
  }

  function stopWaiting() {
    if (!waiting || !activeRequest.current) return;
    sequence.current += 1;
    clearTimeout(activeRequest.current.timeout);
    setDisplay({
      scopeKey,
      phase: "stopped",
      error: "Stopped showing this briefing request. The server model call may still finish or incur usage. Another request is blocked until it finishes; manual queues remain available.",
    });
  }

  return <section className={styles.panel} aria-label="Owner AI operational briefing"
    data-testid="owner-ai-operations-brief">
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>Owner command center / advisory</p>
        <h3>Priorities grounded in saved workload</h3>
      </div>
      <span className={configured ? styles.available : styles.disabled}>
        {configured ? "AI configured · response unverified" : "Setup required"}
      </span>
    </div>
    <p className={styles.description}>
      Request a manual review checklist based only on authorized saved workspace
      queue counts. No customer identities, messages, prices or invoice amounts
      are sent to the model. Suggestions are not operational decisions.
    </p>
    <div className={styles.actions}>
      <button type="button" className={styles.action} onClick={generateBrief}
        disabled={!configured || requestOutstanding} aria-busy={waiting}>
        {waiting ? "Checking saved workload…" :
          requestOutstanding ? "Request still processing" : "Generate owner AI priorities"}
      </button>
      {waiting ? <button type="button" onClick={stopWaiting}
        className={styles.cancel}>Stop waiting</button> : null}
    </div>
    {!configured ? <p role="status" className={styles.notice}>
      An explicitly enabled AI model is required. Operational records,
      dispatch and invoice review remain available without AI.
    </p> : null}
    {state?.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}
    {state?.result ? <div className={styles.result} role="status" aria-live="polite">
      <div className={styles.resultHead}>
        <strong>Model suggestions · human verification required</strong>
        <small>Validated saved-count source</small>
      </div>
      <p className={styles.model}>Model: {state.result.model}</p>
      <p className={styles.suggestions}>{state.result.brief}</p>
      <section className={styles.prioritySection}
        aria-label="Verified saved workload priorities"
        data-testid="owner-saved-count-priorities">
        <div className={styles.priorityHeader}>
          <strong>Top saved workload queues</strong>
          <span>Verified counts · deterministic order</span>
        </div>
        {priorityCards.length > 0 ? <ol className={styles.priorityList}>
          {priorityCards.map(item => <li key={item.kind}>
            <span className={styles.priorityCount}>{item.count}</span>
            <div className={styles.priorityBody}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <Link href={buildStaffModuleHref(workspaceSlug, item.module)}>
                Review saved queue →
              </Link>
            </div>
          </li>)}
        </ol> : <p className={styles.priorityEmpty}>No positive count in these
          verified workload categories. This does not prove all operations are complete.</p>}
      </section>
      <p className={styles.disclosure}>This is an ephemeral review, not a saved
        approval or audit receipt. Verify each recommendation in the authoritative
        workspace before assigning work or contacting anyone.</p>
    </div> : null}
    <div className={styles.queues}>
      <div>
        <strong>Verify against authoritative queues</strong>
        <p>Open saved records before acting on a model suggestion.</p>
      </div>
      <nav aria-label="Verify saved operational priority queues" className={styles.queueLinks}>
        <Link href={buildStaffModuleHref(workspaceSlug, "requests")}>Requests</Link>
        <Link href={buildStaffModuleHref(workspaceSlug, "quotes")}>Quotes</Link>
        <Link href={buildStaffModuleHref(workspaceSlug, "invoices")}>Invoices</Link>
        <Link href={buildStaffModuleHref(workspaceSlug, "jobs")}>Jobs</Link>
        <Link href={buildStaffModuleHref(workspaceSlug, "quality")}>Quality</Link>
      </nav>
    </div>
    <p className={styles.footer}>No AI output in this panel approves a quote,
      triggers an automation, sends a customer message or applies a payment.</p>
  </section>;
}
