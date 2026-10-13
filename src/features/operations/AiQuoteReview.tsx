"use client";

import { useState } from "react";
import { generateQuoteReviewAction } from "./ai-quote-review-action";

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
  const [generation, setGeneration] = useState(0);

  async function generate() {
    if (!configured || state.busy) return;
    const token = generation + 1;
    setGeneration(token);
    setState({ busy: true });
    try {
      const result = await generateQuoteReviewAction(workspaceSlug, quoteId);
      setState(result.ok ? { busy: false, review: result.review, model: result.model }
        : { busy: false, error: result.message });
    } catch {
      setState({ busy: false, error: "AI review could not be completed. Use the verified saved quote instead." });
    }
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
    {!configured ? <p role="status">AI requires explicit server enablement and a configured real model.</p> : null}
    {state.error ? <p role="alert">{state.error}</p> : null}
    {state.review ? <div role="status" aria-live="polite">
      <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Unverified model suggestion · {state.model}</p>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{state.review}</p>
      <small>Staff must verify these suggestions against the saved quote; they are not pricing or delivery proof.</small>
    </div> : null}
  </section>;
}
