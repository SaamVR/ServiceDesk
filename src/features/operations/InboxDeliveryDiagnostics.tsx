"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/product/PagePrimitives";
import { buildStaffModuleHref } from "./staff-modules";
import { inboxQueueHref } from "./inbox-triage";
import { presentOutboundDelivery } from "./inbox-delivery-presentation";
import {
  deliveryReviewLabel, deliveryReviewReasonOptions, selectDeliveryReviewItems,
  distinctDeliveryReviewConversations,
  summarizeDeliveryReviewReasons,
  parseInboxDeliveryDiagnostics,
  type DeliveryReviewChannelFilter, type DeliveryReviewReasonFilter,
  type InboxDeliveryDiagnosticsSnapshot,
} from "./inbox-delivery-diagnostics";
import styles from "./InboxDeliveryDiagnostics.module.css";

/**
 * Operator-initiated, read-only health inspection. The request carries only
 * the workspace slug; the server authenticates the session, role, branch,
 * customer-message scope and outbox evidence. No provider retries, AI
 * invocation, recipient identities, or message bodies are used here.
 */
export function InboxDeliveryDiagnostics({ workspaceSlug }: { workspaceSlug: string }) {
  return <ScopedInboxDeliveryDiagnostics key={workspaceSlug} workspaceSlug={workspaceSlug} />;
}
/** Keep responses, links and authorization scope isolated across workspace switches. */
function ScopedInboxDeliveryDiagnostics({ workspaceSlug }: { workspaceSlug: string }) {
  const [snapshot, setSnapshot] = useState<InboxDeliveryDiagnosticsSnapshot>();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const requestController = useRef<AbortController | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [channelFilter,setChannelFilter] = useState<DeliveryReviewChannelFilter>("ALL");
  const [reasonFilter,setReasonFilter] = useState<DeliveryReviewReasonFilter>("ALL");
  const [onePerConversation,setOnePerConversation] = useState(false);

  useEffect(() => () => {
    requestController.current?.abort();
    requestController.current = null;
  }, []);

  async function load() {
    if (requestController.current) return;
    const controller = new AbortController();
    requestController.current = controller;
    let timedOut = false;
    // Abort can leave a noncompliant transport unresolved. Clear the busy
    // state at the deadline itself; invalidate all late data independently of
    // whether fetch() ever settles or reaches finally().
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (requestController.current === controller) {
        requestController.current = null;
        setState("unavailable");
      }
    }, 15_000);
    setState("loading");
    setSnapshot(undefined);
    setExpanded(false);
    setCancelled(false);
    try {
      const params = new URLSearchParams({ workspaceSlug });
      const response = await fetch("/api/internal/inbox/delivery?" + params, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestController.current !== controller) return;
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        setState("unavailable");
        return;
      }
      const result = parseInboxDeliveryDiagnostics(await response.json() as unknown);
      if (controller.signal.aborted || requestController.current !== controller) return;
      if (!result) {
        setState("unavailable");
        return;
      }
      setSnapshot(result);
      setState("ready");
    } catch {
      if (requestController.current === controller && !controller.signal.aborted) {
        setState("unavailable");
      }
    } finally {
      clearTimeout(timeout);
      // Read-only HTTP cancellation may settle late. Only the active request
      // may affect UI, and timing out cannot leave the spinner stuck forever.
      if (requestController.current === controller) {
        requestController.current = null;
        if (timedOut) setState("unavailable");
      }
    }
  }

  function stopCheck() {
    if (state !== "loading" || !requestController.current) return;
    const old = requestController.current;
    requestController.current = null;
    old.abort();
    setState("idle");
    setCancelled(true);
  }

  const resetReviewFilters = () => {
    setChannelFilter("ALL");
    setReasonFilter("ALL");
    setOnePerConversation(false);
    setExpanded(false);
  };
  const anyReviewFilter = channelFilter !== "ALL" || reasonFilter !== "ALL" || onePerConversation;
  const allNeedsReview = snapshot?.items.filter(item => item.health === "NEEDS_REVIEW") ?? [];
  const matchingNeedsReview = selectDeliveryReviewItems(allNeedsReview,channelFilter,reasonFilter);
  const priorityReasons = summarizeDeliveryReviewReasons(allNeedsReview,channelFilter);
  const groupedNeedsReview = distinctDeliveryReviewConversations(matchingNeedsReview);
  const displayedReviewSource = onePerConversation ? groupedNeedsReview : matchingNeedsReview;
  const needsReview = expanded ? displayedReviewSource : displayedReviewSource.slice(0, 8);
  const inboxHref = buildStaffModuleHref(workspaceSlug, "inbox");
  return (
    <section className={styles.panel} aria-label="Outbound delivery diagnostics">
      <div className={styles.heading}>
        <div>
          <h3>Delivery health</h3>
          <p>Stored outbound evidence · authorized staff only</p>
        </div>
        <button
          className={styles.refresh}
          type="button"
          disabled={state === "loading"}
          onClick={load}
          aria-busy={state === "loading"}
        >
          {state === "loading" ? "Checking…" : state === "ready" ? "Refresh" : "Check status"}
        </button>
        {state === "loading" ? (
          <button type="button" className={styles.stop} onClick={stopCheck}>
            Stop check
          </button>
        ) : null}
      </div>
      <div aria-live="polite" aria-atomic="true" className={styles.feedback}>
        {state === "idle" ? (
          <p>{cancelled
            ? "Stopped this read-only check. Delivery was not changed; recheck the saved inbox if a result remains uncertain."
            : "Check saved delivery outcomes on demand. No messages will be sent."}</p>
        ) : state === "loading" ? (
          <p>Reading authorized delivery records…</p>
        ) : state === "unavailable" ? (
          <p role="status">Delivery diagnostics are unavailable for this account or branch. No delivery status has been confirmed by this check.</p>
        ) : snapshot ? (
          <>
            <dl className={styles.counts} aria-label="Delivery status summary">
              <div><dt>Review</dt><dd>{snapshot.counts.review}</dd></div>
              <div><dt>Pending</dt><dd>{snapshot.counts.pending}</dd></div>
              <div><dt>Confirmed</dt><dd>{snapshot.counts.ok}</dd></div>
            </dl>
            <p className={styles.sample}>
              {snapshot.scannedOutboundMessages} authorized outbound records sampled
              {snapshot.truncated ? " · sample incomplete" : ""}
              . Confirmed includes delivered/read evidence only.
              {" "}Snapshot captured <time dateTime={snapshot.generatedAt}>{snapshot.generatedAt}</time>.
              This sample is not a live delivery feed.
            </p>
            {allNeedsReview.length ? (
              <div className={styles.items}>
                <h4>Needs operator review</h4>
                <div className={styles.filters} aria-label="Filter authorized delivery problems">
                  <label>Channel
                    <select value={channelFilter} onChange={event=>{
                      const next=event.target.value;
                      if(next!=="ALL" && next!=="EMAIL" && next!=="WHATSAPP")return;
                      setChannelFilter(next);
                      setExpanded(false);
                    }}>
                      <option value="ALL">All channels</option>
                      <option value="EMAIL">Email only</option>
                      <option value="WHATSAPP">WhatsApp only</option>
                    </select>
                  </label>
                  <label>Why review?
                    <select value={reasonFilter} onChange={event=>{
                      const next=event.target.value;
                      if(!deliveryReviewReasonOptions.some(opt=>opt.value===next))return;
                      setReasonFilter(next as DeliveryReviewReasonFilter);
                      setExpanded(false);
                    }}>
                      {deliveryReviewReasonOptions.map(option=>
                        <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                {anyReviewFilter ? <button type="button" className={styles.clearFilters}
                  onClick={resetReviewFilters}>
                  Clear delivery review filters
                </button> : null}
                {priorityReasons.length ? <div className={styles.reasonSummary}
                  aria-label="Saved delivery failure categories in the selected channel">
                  {priorityReasons.map(reason=><button
                    key={reason.value} type="button"
                    aria-pressed={reasonFilter===reason.value}
                    onClick={()=>{setReasonFilter(current=>
                      current===reason.value?"ALL":reason.value);setExpanded(false);}}>
                    <strong>{reason.count}</strong>
                    <span>{reason.label}</span>
                  </button>)}
                </div> : null}
                <label className={styles.conversationToggle}>
                  <input type="checkbox" checked={onePerConversation}
                    onChange={event=>{setOnePerConversation(event.target.checked);
                      setExpanded(false);}} />
                  <span>Show the highest-priority issue per conversation
                    ({groupedNeedsReview.length} affected conversation(s))</span>
                </label>
                {onePerConversation ? <p className={styles.sample} role="note">
                  {matchingNeedsReview.length - groupedNeedsReview.length} additional
                  sampled message issue(s) are hidden only in this view.
                  Turn grouping off to inspect every matching saved message.
                  All original delivery counts remain unchanged.
                </p> : null}
                <p className={styles.sample} role="status">
                  {matchingNeedsReview.length} matching review record(s) from
                  {allNeedsReview.length} sampled review items. Filters only
                  change this display; they do not alter delivery evidence.
                </p>
                {needsReview.length ? <ul>
                  {needsReview.map((item) => (
                    <li key={item.messageId}>
                      <Link
                        href={inboxHref + inboxQueueHref("all", item.conversationId)}
                        className={styles.reviewLink}
                      >
                        <span>
                          <strong>{deliveryReviewLabel(item.reason)}</strong>
                          <small>{item.channel} · {item.ageMinutes} min since recorded</small>
                        </span>
                        <StatusBadge tone={item.deliveryState === "FAILED" ? "danger" : "warning"}>
                          {presentOutboundDelivery(item.deliveryState).label}
                        </StatusBadge>
                      </Link>
                    </li>
                  ))}
                </ul> : <p className={styles.sample}>
                  No review record matches the selected channel and reason.
                  Use Clear delivery review filters to inspect other saved source issues.
                </p>}
                {displayedReviewSource.length > 8 ? (
                  <button type="button" className={styles.more}
                    onClick={() => setExpanded(value => !value)}
                    aria-expanded={expanded}>
                    {expanded ? "Show fewer review records" :
                      `Show all ${displayedReviewSource.length} matching review records`}
                  </button>
                ) : null}
                {displayedReviewSource.length > needsReview.length ? (
                  <p className={styles.sample}>Showing {needsReview.length} of {displayedReviewSource.length} displayed review records in this authorized sample.</p>
                ) : null}
              </div>
            ) : (
              <p className={styles.sample}>No review-required records in the authorized sample.</p>
            )}
            <p className={styles.disclaimer}>
              This panel does not resend messages or establish customer receipt without provider evidence.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
