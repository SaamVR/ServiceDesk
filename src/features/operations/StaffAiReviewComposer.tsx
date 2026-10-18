"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { buildStaffModuleHref } from "./staff-modules";
import { inboxQueueHref } from "./inbox-triage";
import {
  parseReviewedAiDraft,
  parseReviewedReplyReceipt,
  type ReviewedAiDraft,
  type ApprovedReplyReceipt,
  type StaffAiReviewError,
  staffAiReviewErrorAfterEdit,
} from "./staff-ai-review-contract";
import { presentOutboundDelivery } from "./inbox-delivery-presentation";
import { staffAiReviewScopeKey } from "./staff-ai-review-scope";
import {
  detectStaffReplyRisks, hasUnsafeReplyFormatting, staffReplyRiskLabels,
} from "./staff-ai-reply-risk";
import { boundedStaffRequestSignal, STAFF_AI_DRAFT_TIMEOUT_MS } from "./staff-ai-request-signal";
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
  const replyFieldId = useId();
  const [body, setBody] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [sensitiveConfirmed, setSensitiveConfirmed] = useState(false);
  const [busy, setBusy] = useState<"idle" | "drafting" | "approving">("idle");
  const [error, setError] = useState<StaffAiReviewError>();
  const [receipt, setReceipt] = useState<ApprovedReplyReceipt>();
  const controller = useRef<AbortController | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function suggest() {
    // State updates are asynchronous: a second immediate click must NOT
    // abort and replace an already-issued (potentially billable) model call.
    if (busy !== "idle" || receipt || controller.current) return;
    const pending = new AbortController();
    controller.current = pending;
    const requestSignal = boundedStaffRequestSignal(pending, STAFF_AI_DRAFT_TIMEOUT_MS);
    // AbortSignal.timeout may fire without fetch()/response.json() settling.
    // Unlock the screen immediately, and invalidate buffered late model data.
    const onDraftDeadline = () => {
      if (pending.signal.aborted || controller.current !== pending) return;
      controller.current = null;
      setBusy("idle");
      setError("draft");
    };
    requestSignal.addEventListener("abort", onDraftDeadline, { once: true });
    setBusy("drafting");
    setError(undefined);
    setDraft(undefined);
    setBody("");
    setConfirmed(false);
    setSensitiveConfirmed(false);
    idempotencyKey.current = null;
    try {
      const response = await fetch("/api/internal/ai/draft", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ workspaceSlug, conversationId, messageId: sourceMessageId }),
        signal: requestSignal,
      });
      if (pending.signal.aborted || requestSignal.aborted || controller.current !== pending) return;
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        setError("draft");
        return;
      }
      const parsed = parseReviewedAiDraft(await response.json() as unknown, conversationId, sourceMessageId);
      if (pending.signal.aborted || requestSignal.aborted || controller.current !== pending) return;
      if (!parsed) {
        setError("draft");
        return;
      }
      setDraft(parsed);
      setBody(parsed.replyDraft);
      setSensitiveConfirmed(false);
    } catch {
      if (!pending.signal.aborted && controller.current === pending) setError("draft");
    } finally {
      requestSignal.removeEventListener("abort", onDraftDeadline);
      if (controller.current === pending && !pending.signal.aborted) {
        if (requestSignal.aborted) setError("draft");
        setBusy("idle");
        controller.current = null;
      }
    }
  }

  function cancelSuggestion() {
    if (busy !== "drafting") return;
    controller.current?.abort();
    controller.current = null;
    setBusy("idle");
    setDraft(undefined);
    setBody("");
    setConfirmed(false);
    setSensitiveConfirmed(false);
    setError("cancelled");
    // Cancelling the browser request does not certify that provider billing stopped.
  }

  const unsafeFormatting = hasUnsafeReplyFormatting(body);
  const reviewRisks = detectStaffReplyRisks(body);
  const needsSensitiveReview = reviewRisks.length > 0;
  async function approve() {
    const reviewedBody = body.trim();
    // Approval is a durable, idempotent command. Never abort a still-running
    // approval and issue a second network command before React sets busy.
    if (busy !== "idle" || controller.current || !draft || draft.handoverRequired ||
        !confirmed || unsafeFormatting ||
        (needsSensitiveReview && !sensitiveConfirmed) ||
        !reviewedBody || reviewedBody.length > 4_000 ||
        receipt || error === "stale") return;
    const pending = new AbortController();
    controller.current = pending;
    const requestSignal = boundedStaffRequestSignal(pending);
    // A durable command can still be processed upstream after client timeout.
    // Re-enable manual verification without inventing a failed customer send.
    const onApprovalDeadline = () => {
      if (pending.signal.aborted || controller.current !== pending) return;
      controller.current = null;
      setBusy("idle");
      setError("approval");
    };
    requestSignal.addEventListener("abort", onApprovalDeadline, { once: true });
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
        signal: requestSignal,
      });
      if (requestSignal.aborted || pending.signal.aborted || controller.current !== pending) return;
      if (response.status === 409) {
        setError("stale");
        return;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        setError("approval");
        return;
      }
      const parsed = parseReviewedReplyReceipt(await response.json() as unknown, conversationId, sourceMessageId);
      if (requestSignal.aborted || pending.signal.aborted || controller.current !== pending) return;
      if (!parsed) {
        setError("approval");
        return;
      }
      setReceipt(parsed);
      setConfirmed(false);
    } catch {
      if (!pending.signal.aborted && controller.current === pending) setError("approval");
    } finally {
      requestSignal.removeEventListener("abort", onApprovalDeadline);
      if (controller.current === pending && !pending.signal.aborted) {
        // Timed-out approval may already have queued a durable reply.
        // Do not invent a failed send or assign a fresh idempotency key.
        if (requestSignal.aborted) setError("approval");
        setBusy("idle");
        controller.current = null;
      }
    }
  }

  const historyHref = buildStaffModuleHref(workspaceSlug, "inbox") +
    inboxQueueHref("all", conversationId);
  const canApprove = Boolean(draft && !draft.handoverRequired &&
    body.trim().length > 0 && body.trim().length <= 4_000 &&
    confirmed && !unsafeFormatting &&
    (!needsSensitiveReview || sensitiveConfirmed) &&
    busy === "idle" && !receipt && error !== "stale");

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

      {busy === "drafting" ? (
        <button className={styles.secondary} type="button" onClick={cancelSuggestion}>
          Cancel suggestion
        </button>
      ) : null}
      <div className={styles.feedback} aria-live="polite" aria-atomic="true">
        {error === "cancelled" ? (
          <p>Suggestion request cancelled in this browser. No reply was approved or queued.</p>
        ) : null}
        {error === "draft" ? (
          <p>AI drafting did not return a verified suggestion. The model may still finish upstream; continue with the standard staff reply form.</p>
        ) : error === "stale" ? (
          <p>The conversation changed or a newer customer message arrived.
            Reload before approving again.{" "}
            <Link href={historyHref} className={styles.historyLink}>
              Find current saved conversation in Inbox →
            </Link>
          </p>
        ) : error === "approval" ? (
          <p>Approval could not be confirmed. Check the saved conversation before trying again;
            the same approval key will be reused.{" "}
            <Link href={historyHref} className={styles.historyLink}>
              Verify saved conversation in Inbox →
            </Link>
          </p>
        ) : null}
        {receipt ? (
          <div className={styles.receipt}>
            <strong>{receipt.state === "EXISTING_REPLY" ? "Previously approved reply found" : "Staff-reviewed reply queued"}</strong>
            <p>{presentOutboundDelivery(receipt.deliveryState).label}. Queue acceptance is not customer delivery confirmation.</p>
            <p><Link href={historyHref} className={styles.historyLink}>
              Verify saved provider status in Inbox →
            </Link></p>
          </div>
        ) : draft ? (
          <>
            {draft.handoverRequired ? (
              <p className={styles.warning}>AI identified a handover requirement. This suggestion cannot be queued here. Use the standard human reply workflow.</p>
            ) : null}
            <label className={styles.label} htmlFor={replyFieldId}>
              Review and edit the proposed reply
            </label>
            <textarea
              className={styles.input}
              id={replyFieldId}
              value={body}
              maxLength={4000}
              rows={5}
              onChange={(event) => {
                setBody(event.target.value);
                setConfirmed(false);
                setSensitiveConfirmed(false);
                setError(staffAiReviewErrorAfterEdit);
                idempotencyKey.current = null;
              }}
              disabled={busy !== "idle" || draft.handoverRequired}
            />
            <p className={styles.limit}>{body.length}/4000 characters · generated suggestions are not verified facts</p>
            {unsafeFormatting ? <p className={styles.warning} role="alert">
              Edited reply contains hidden or unsafe formatting controls.
              Remove those characters before approving or queueing a response.
            </p> : null}
            {!draft.handoverRequired ? (
              <>
                {needsSensitiveReview ? <div className={styles.warning}
                  role="note" aria-label="Additional sensitive reply review required">
                  <strong>Additional verification required</strong>
                  <p>This reply contains possible sensitive commitments or
                    contact instructions. Heuristic detection may miss risks.
                    Verify the current saved record and authorized channel.</p>
                  <ul>{reviewRisks.map(risk=><li key={risk}>
                    {staffReplyRiskLabels[risk]}</li>)}</ul>
                  <label className={styles.confirm}>
                    <input type="checkbox" checked={sensitiveConfirmed}
                      disabled={busy !== "idle"}
                      onChange={event=>setSensitiveConfirmed(event.target.checked)} />
                    <span>I verified these statements against saved records
                      and approve the exact edited reply.</span>
                  </label>
                </div> : null}
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
