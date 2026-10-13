"use client";

import { useEffect, useRef, useState } from "react";


type State = { busy: boolean; review?: string; model?: string; error?: string };

/** Explicit staff action. Never posts quotes, accepts payments or sends messages. */
export function AiQuoteReview({
  workspaceSlug, quoteId, configured,
}: { workspaceSlug: string; quoteId: string; configured: boolean }) {
  return <ScopedQuoteReview key={workspaceSlug + ":" + quoteId}
    workspaceSlug={workspaceSlug} quoteId={quoteId} configured={configured} />;
}

function ScopedQuoteReview({
  workspaceSlug, quoteId, configured,
}: { workspaceSlug: string; quoteId: string; configured: boolean }) {
  const [state, setState] = useState<State>({ busy: false });
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestSequence.current += 1;
    activeRequest.current?.abort();
  }, []);

  async function generate() {
    if (!configured || state.busy) return;
    const id = ++requestSequence.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    setState({ busy: true });
    try {
      const response = await fetch("/api/internal/ai/quote-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ workspaceSlug, quoteId }),
        signal: controller.signal,
      });
      if (requestSequence.current !== id || controller.signal.aborted) return;
      const result: unknown = await response.json();
      if (requestSequence.current !== id || controller.signal.aborted) return;
      if (response.ok && result && typeof result === "object" &&
          "state" in result && result.state === "AI_STAFF_REVIEW_ONLY" &&
          "review" in result && typeof result.review === "string" &&
          "model" in result && typeof result.model === "string") {
        setState({ busy: false, review: result.review, model: result.model });
      } else {
        setState({ busy: false, error: "AI review was unavailable. Check model configuration and your access to this saved quote; no message was sent." });
      }
    } catch {
      if (requestSequence.current !== id || controller.signal.aborted) return;
      setState({ busy: false, error: "AI review could not be completed. Use the verified saved quote instead." });
    } finally {
      if (requestSequence.current === id) activeRequest.current = null;
    }
  }

  function cancelReview() {
    if (!state.busy) return;
    requestSequence.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setState({ busy: false, error: "Cancellation was requested. A paid provider request may still be processing; no quote or customer action was changed." });
  }

  return <section aria-label="Staff AI quote review"
    style={{ marginTop: 12, border: "1px solid #cfe2df", background: "#f5faf8",
      borderRadius: 12, padding: 16, display: "grid", gap: 10 }}>
    <strong>AI quote checklist · staff review only</strong>
    <p style={{ margin: 0, fontSize: ".85rem", lineHeight: 1.5 }}>
      AI receives only the verified saved service codes and durations—not prices,
      contact details, addresses or customer notes. It cannot approve, send or change this quote.
    </p>
    <button type="button" disabled={!configured || state.busy} onClick={generate}
      aria-busy={state.busy}
      style={{ justifySelf: "start", border: 0, borderRadius: 8,
        color: "#fff", background: "#18564a", padding: "9px 14px",
        cursor: configured && !state.busy ? "pointer" : "not-allowed" }}>
      {state.busy ? "Checking saved quote…" : "Generate AI review checks"}
    </button>
    {state.busy ? (
      <button type="button" onClick={cancelReview}
        style={{ justifySelf: "start", border: "1px solid #b2cbc6", borderRadius: 8,
          background: "white", color: "#194b43", padding: "9px 14px" }}>
        Cancel pending review display
      </button>
    ) : null}
    {!configured ? <p role="status">AI requires explicit server enablement and a configured real model.</p> : null}
    {state.error ? <p role="alert">{state.error}</p> : null}
    {state.review ? <div role="status" aria-live="polite">
      <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Unverified model suggestion · {state.model}</p>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{state.review}</p>
      <small>Staff must verify these suggestions against the saved quote; they are not pricing or delivery proof.</small>
    </div> : null}
  </section>;
}
