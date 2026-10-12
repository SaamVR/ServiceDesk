"use client";

import { useEffect, useRef, useState } from "react";
import {
  parseReviewedAiDraft,
  parseReviewedReplyReceipt,
  type ReviewedAiDraft,
  type ApprovedReplyReceipt,
} from "./staff-ai-review-contract";
import { presentOutboundDelivery } from "./inbox-delivery-presentation";
import { staffAiReviewScopeKey } from "./staff-ai-review-scope";
import styles from "./StaffAiReviewComposer.module.css";

/**
 * Optional, explicit human workflow. AI may propose text but never approve,
 * execute tools, or send it. Approval is a separate staff-confirmed server
 * transaction with source-message/version/idempotency/consent checks.
 */
type StaffAiReviewProps = {
  workspaceSlug: string;
  conversationId: string;
  sourceMessageId: string;
  expectedVersion: number;
};

/** A key on the *internal* component is necessary even if a parent forgets
 * its own key: a changed tenant/thread/message/version can never inherit
 * another customer's text, approval or retry idempotency key. */
export function StaffAiReviewComposer(props: StaffAiReviewProps) {
  return <ScopedStaffAiReviewComposer
    key={staffAiReviewScopeKey(props)}
    {...props}
  />;
}

function ScopedStaffAiReviewComposer({
  workspaceSlug,
  conversationId,
  sourceMessageId,
  expectedVersion,
}: StaffAiReviewProps) {
  const [draft, setDraft] = useState<ReviewedAiDraft>();
  const [body, setBody] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"idle" | "drafting" | "approving">("idle");
  const [error, setError] = useState<"draft" | "approval" | "stale">();
  const [receipt, setReceipt] = useState<ApprovedReplyReceipt>();
  const controller = useRef<AbortController | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function suggest() {
    if (busy !== "idle" || receipt) return;
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setBusy("drafting");
    setError(undefined);
    setDraft(undefined);
    setBody("");
    setConfirmed(false);
    idempotencyKey.current = null;
    try {
      const response = await fetch("/api/internal/ai/draft", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ workspaceSlug, conversationId, messageId: sourceMessageId }),
        signal: pending.signal,
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        setError("draft");
        return;
      }
      const parsed = parseReviewedAiDraft(await response.json() as unknown, conversationId, sourceMessageId);
      if (!parsed) {
        setError("draft");
        return;
      }
      setDraft(parsed);
      setBody(parsed.replyDraft);
    } catch {
      if (!pending.signal.aborted) setError("draft");
    } finally {
      if (!pending.signal.aborted) setBusy("idle");
    }
  }

  async function approve() {
    const reviewedBody = body.trim();
    if (busy !== "idle" || !draft || draft.handoverRequired ||
        !confirmed || !reviewedBody || reviewedBody.length > 4_000 ||
        receipt || error === "stale") return;
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setBusy("approving");
    setError(undefined);
    // Preserve this key across uncertain network retries. An edit starts a
    // new approval intent, never silently reuses a key for another body.
    idempotencyKey.current ??= crypto.randomUUID().replaceAll("-", "");
    try {
      const response = await fetch("/api/internal/inbox/reply", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          workspaceSlug, conversationId,
          sourceMessageId,
          reviewedBody,
          expectedVersion,
          idempotencyKey: idempotencyKey.current,
          confirmedByStaff: true,
        }),
        signal: pending.signal,
      });
      if (response.status === 409) {
        setError("stale");
        return;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        setError("approval");
        return;
      }
      const parsed = parseReviewedReplyReceipt(await response.json() as unknown, conversationId, sourceMessageId);
      if (!parsed) {
        setError("approval");
        return;
      }
      setReceipt(parsed);
      setConfirmed(false);
    } catch {
      if (!pending.signal.aborted) setError("approval");
    } finally {
      if (!pending.signal.aborted) setBusy("idle");
    }
  }

  const canApprove = Boolean(draft && !draft.handoverRequired &&
    body.trim().length > 0 && body.trim().length <= 4_000 &&
    confirmed && busy === "idle" && !receipt && error !== "stale");

  return (
    <section className={styles.panel} aria-label="AI-assisted human reply review">
      <header className={styles.header}>
        <div>
          <h3>AI reply assistant</h3>
          <p>Optional draft · human-reviewed · never sent automatically</p>
        </div>
        {!draft && !receipt ? (
          <button className={styles.secondary} type="button" onClick={suggest} disabled={busy !== "idle"}>
            {busy === "drafting" ? "Preparing…" : "Suggest a reply"}
          </button>
        ) : null}
      </header>

      <div className={styles.feedback} aria-live="polite" aria-atomic="true">
        {error === "draft" ? (
          <p>AI drafting is unavailable for this workspace. Continue with the standard staff reply form.</p>
        ) : error === "stale" ? (
          <p>The conversation changed or a newer customer message arrived. Reload this conversation before approving another reply.</p>
        ) : error === "approval" ? (
          <p>Approval could not be confirmed. Check the saved conversation before trying again; the same approval key will be reused.</p>
        ) : null}
        {receipt ? (
          <div className={styles.receipt}>
            <strong>{receipt.state === "EXISTING_REPLY" ? "Previously approved reply found" : "Staff-reviewed reply queued"}</strong>
            <p>{presentOutboundDelivery(receipt.deliveryState).label}. Queue acceptance is not customer delivery confirmation.</p>
            <p>Return to the message history to verify the stored provider status.</p>
          </div>
        ) : draft ? (
          <>
            {draft.handoverRequired ? (
              <p className={styles.warning}>AI identified a handover requirement. This suggestion cannot be queued here. Use the standard human reply workflow.</p>
            ) : null}
            <label className={styles.label} htmlFor="ai-reviewed-reply">
              Review and edit the proposed reply
            </label>
            <textarea
              className={styles.input}
              id="ai-reviewed-reply"
              value={body}
              maxLength={4000}
              rows={5}
              onChange={(event) => {
                setBody(event.target.value);
                setConfirmed(false);
                setError(undefined);
                idempotencyKey.current = null;
              }}
              disabled={busy !== "idle" || draft.handoverRequired}
            />
            <p className={styles.limit}>{body.length}/4000 characters · generated suggestions are not verified facts</p>
            {!draft.handoverRequired ? (
              <>
                <label className={styles.confirm}>
                  <input type="checkbox" checked={confirmed} disabled={busy !== "idle"}
                    onChange={(event) => setConfirmed(event.target.checked)} />
                  <span>I reviewed and approve this exact reply for the selected customer conversation.</span>
                </label>
                <button className={styles.primary} type="button" onClick={approve} disabled={!canApprove}>
                  {busy === "approving" ? "Queueing reviewed reply…" : "Queue reviewed reply"}
                </button>
              </>
            ) : null}
          </>
        ) : (
          <p>Generate a suggestion only when needed. The model cannot send a reply or approve any business action.</p>
        )}
      </div>
    </section>
  );
}
