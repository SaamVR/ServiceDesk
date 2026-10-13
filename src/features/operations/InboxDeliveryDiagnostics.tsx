"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/product/PagePrimitives";
import { buildStaffModuleHref } from "./staff-modules";
import { inboxQueueHref } from "./inbox-triage";
import { presentOutboundDelivery } from "./inbox-delivery-presentation";
import {
  deliveryReviewLabel,
  parseInboxDeliveryDiagnostics,
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

  useEffect(() => () => {
    requestController.current?.abort();
  }, []);

  async function load() {
    if (state === "loading") return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    setState("loading");
    setSnapshot(undefined);
    try {
      const params = new URLSearchParams({ workspaceSlug });
      const response = await fetch("/api/internal/inbox/delivery?" + params, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        setState("unavailable");
        return;
      }
      const result = parseInboxDeliveryDiagnostics(await response.json() as unknown);
      if (controller.signal.aborted) return;
      if (!result) {
        setState("unavailable");
        return;
      }
      setSnapshot(result);
      setState("ready");
    } catch {
      if (!controller.signal.aborted) setState("unavailable");
      else if (requestController.current === controller) setState("unavailable");
    } finally {
      clearTimeout(timeout);
      if (requestController.current === controller) requestController.current = null;
    }
  }

  const needsReview = snapshot?.items.filter((item) => item.health === "NEEDS_REVIEW").slice(0, 8) ?? [];
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
      </div>
      <div aria-live="polite" aria-atomic="true" className={styles.feedback}>
        {state === "idle" ? (
          <p>Check the latest recorded delivery outcomes. No messages will be sent.</p>
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
            </p>
            {needsReview.length ? (
              <div className={styles.items}>
                <h4>Needs operator review</h4>
                <ul>
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
                </ul>
                {snapshot.counts.review > needsReview.length ? (
                  <p className={styles.sample}>Showing the first {needsReview.length} of {snapshot.counts.review} review items in this sample.</p>
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
