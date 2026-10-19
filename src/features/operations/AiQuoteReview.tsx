"use client";

import { useEffect, useRef, useState } from "react";
import {
  describeQuoteReviewHttpFailure,
  parseAuthorizedQuoteReview,
  type VerifiedStaffQuoteReview,
} from "./ai-quote-review-response";
import styles from "./AiQuoteReview.module.css";

// Server Codex gateway timeout may reach 60s on the single approved test
// workspace. Keep browser wait above that maximum; abort is not proof of
// provider cancellation or zero cost.
const REVIEW_TIMEOUT_MS = 75_000;

type Status = {
  scopeKey: string;
  busy: boolean;
  review?: VerifiedStaffQuoteReview;
  error?: string;
};

/** Explicit staff action. No quote mutation, payment or outbound delivery. */
/** Saved quote revisions can change without changing their UUID. Keep the
 * advisory's in-memory result, consent and pending network ownership scoped
 * to that authoritative revision. The model does not receive financial data.
 */
export function aiQuoteReviewScopeKey(workspaceSlug:string,quoteId:string,
  quoteVersion:number|undefined,configured:boolean):string {
  const revision=quoteVersion===undefined?"legacy-unversioned":
    Number.isSafeInteger(quoteVersion) && quoteVersion>=0
      ? String(quoteVersion) : "invalid-version";
  return [workspaceSlug,quoteId,revision,configured?"configured":"disabled"].join(":");
}
type AiQuoteReviewProps={
  workspaceSlug:string;quoteId:string;quoteVersion?:number;configured:boolean;
};
export function AiQuoteReview(props:AiQuoteReviewProps) {
  return <ScopedQuoteReview
    key={aiQuoteReviewScopeKey(props.workspaceSlug,props.quoteId,props.quoteVersion,props.configured)}
    {...props} />;
}
function ScopedQuoteReview({
  workspaceSlug, quoteId, quoteVersion, configured,
}: AiQuoteReviewProps) {
  const scopeKey = aiQuoteReviewScopeKey(workspaceSlug,quoteId,quoteVersion,configured);
  const versionTrusted = quoteVersion===undefined ||
    (Number.isSafeInteger(quoteVersion) && quoteVersion>=0);
  // Each optional model review may incur inference usage. Acknowledgement is
  // scoped to the saved quote and consumed exactly once at invocation.
  const [approvedScope, setApprovedScope] = useState<string | null>(null);
  const operatorApproved = approvedScope === scopeKey;
  const [status, setStatus] = useState<Status>();
  const scoped = status?.scopeKey === scopeKey ? status : undefined;
  const busy = scoped?.busy ?? false;
  const review = scoped?.review;
  const error = scoped?.error;
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, [scopeKey]);

  async function generate() {
    if (!configured || !versionTrusted || !operatorApproved || busy || activeRequest.current) return;
    setApprovedScope(null);
    const submittedScope = scopeKey;
    const expectedQuoteId = quoteId;
    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus({ scopeKey: submittedScope, busy: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      // A suspended fetch/JSON stream may never settle after abort. Release
      // the operator's wait now; a subsequent late result has lost ownership.
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setStatus(previous => previous?.scopeKey === submittedScope && previous.busy
          ? { scopeKey: submittedScope, busy: false,
              error: "AI quote review exceeded 75 seconds. The browser stopped waiting; provider-side cancellation is not confirmed." }
          : previous);
      }
    }, REVIEW_TIMEOUT_MS);

    let result: VerifiedStaffQuoteReview | undefined;
    let message: string | undefined;
    try {
      const response = await fetch("/api/internal/ai/quote-review", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ workspaceSlug, quoteId: expectedQuoteId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        message = describeQuoteReviewHttpFailure(response.status);
      } else if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        message = "The AI reviewer returned an invalid response type. Use the saved quote instead.";
      } else {
        const payload: unknown = await response.json();
        result = parseAuthorizedQuoteReview(payload, expectedQuoteId) ?? undefined;
        if (!result) {
          message = "The AI response could not be tied to this saved quote. Refresh the quote; no business action was taken.";
        }
      }
    } catch {
      message = timedOut
        ? "AI quote review exceeded 75 seconds. The browser stopped waiting; provider-side cancellation is not confirmed."
        : "AI review could not be completed. Verify the saved quote manually; no customer action was authorized.";
    } finally {
      clearTimeout(timeout);
      // A fully buffered success may settle after a timeout abort. Never
      // surface a quote review from a request that is no longer authorized.
      if (controller.signal.aborted) {
        result = undefined;
        if (timedOut) message =
          "AI quote review exceeded 75 seconds. The browser stopped waiting; provider-side cancellation is not confirmed.";
      }
      // A cancelled, changed-quote or changed-workspace request can never
      // hydrate the current panel with obsolete or cross-scope AI output.
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setStatus(previous => previous?.scopeKey === submittedScope && previous.busy
          ? { scopeKey: submittedScope, busy: false, review: result, error: message }
          : previous);
      }
    }
  }

  function cancelReview() {
    if (!busy || !activeRequest.current) return;
    const request = activeRequest.current;
    activeRequest.current = null;
    request.abort();
    setStatus(previous => previous?.scopeKey === scopeKey
      ? { scopeKey, busy: false,
          error: "Stopped waiting for AI quote review. A provider call may still finish or incur usage; no quote or customer action was authorized." }
      : previous);
  }

  return <section className={styles.panel} aria-label="Staff AI quote review"
    data-testid="staff-saved-quote-ai-review">
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>AI / manual approval</p>
        <h3>Quote safety checklist</h3>
      </div>
      <span className={styles.state}>{configured ? "Review-only model" : "Setup required"}</span>
    </div>
    <p className={styles.description}>
      AI receives only verified saved service codes and durations—not prices,
      contact details, addresses or customer notes. Output containing monetary
      amounts, contact details or links is rejected. It cannot approve, send or change this quote.
      Model advice still requires source verification.
    </p>
    <label className={styles.consent}>
      <input type="checkbox" checked={operatorApproved} disabled={!configured || busy}
        onChange={event=>setApprovedScope(event.target.checked ? scopeKey : null)} />
      <span>I authorize one optional model-generated quote checklist.
        It may consume provider tokens or incur usage. The result cannot
        approve a quote, change prices, or send customer messages.</span>
    </label>
    <div className={styles.actions}>
      <button className={styles.action} type="button" onClick={generate}
        disabled={!configured || !versionTrusted || !operatorApproved || busy} aria-busy={busy}>
        {busy ? "Reviewing saved quote…" : "Generate AI review checks"}
      </button>
      {busy ? <button type="button" className={styles.cancel} onClick={cancelReview}>
        Stop waiting
      </button> : null}
    </div>
    {!configured ? <p role="status" className={styles.notice}>
      AI requires explicit server enablement and an authorized model.
      Manual quoting remains available.
    </p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {review ? <div role="status" aria-live="polite" className={styles.result}>
      <strong>Unverified model suggestion · staff approval required</strong>
      <p className={styles.model}>Model: {review.model}</p>
      <p className={styles.review}>{review.review}</p>
      <small>Match suggestions against the saved quote before taking any authorized action.
        No payment, message or provider delivery is proven here.</small>
    </div> : null}
    <p className={styles.footer}>Results are advisory, not pricing authority. A response for a different
      quote, invalid source or obsolete workspace is never displayed.</p>
  </section>;
}
