"use client";

import { useState } from "react";
import Link from "next/link";
import { AiRequestBrief } from "./AiRequestBrief";
import { AiQuoteReview } from "./AiQuoteReview";
import { buildStaffModuleHref } from "./staff-modules";
import styles from "./AiStudioWorkspace.module.css";

export type StudioSavedRecord = { id: string; label: string };

export function AiStudioWorkbench({
  workspaceSlug, configured, requests, quotes,
}: {
  workspaceSlug: string;
  configured: boolean;
  requests: readonly StudioSavedRecord[];
  quotes: readonly StudioSavedRecord[];
}) {
  return <ScopedStudioWorkbench key={workspaceSlug} workspaceSlug={workspaceSlug}
    configured={configured} requests={requests} quotes={quotes} />;
}

function ScopedStudioWorkbench({
  workspaceSlug, configured, requests, quotes,
}: {
  workspaceSlug: string;
  configured: boolean;
  requests: readonly StudioSavedRecord[];
  quotes: readonly StudioSavedRecord[];
}) {
  const [mode, setMode] = useState<"request" | "quote">("request");
  const [requestId, setRequestId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  // Never submit or display an arbitrary record ID: selectors are filled only
  // from the current authenticated, branch-scoped server snapshot.
  const selectedRequest = requests.find(item => item.id === requestId);
  const selectedQuote = quotes.find(item => item.id === quoteId);
  const selected = mode === "request" ? selectedRequest : selectedQuote;

  return (
    <section className={styles.workbench} aria-label="AI Studio saved-record workbench">
      <div className={styles.panelTitle}>
        <div>
          <p className={styles.overline}>Hands-on workbench</p>
          <h2>Generate with verified business context</h2>
          <p>Choose a saved record. ServiceDesk rechecks your session, branch access and source facts before any explicit model request.</p>
        </div>
        <span className={styles.manualBadge}>Review required</span>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="AI Studio task">
        <button type="button" role="tab" aria-selected={mode === "request"}
          aria-controls="studio-record-panel" id="studio-request-tab"
          className={mode === "request" ? styles.tabActive : styles.tab}
          onClick={() => setMode("request")}>Request intelligence</button>
        <button type="button" role="tab" aria-selected={mode === "quote"}
          aria-controls="studio-record-panel" id="studio-quote-tab"
          className={mode === "quote" ? styles.tabActive : styles.tab}
          onClick={() => setMode("quote")}>Quote review</button>
      </div>

      <div id="studio-record-panel" role="tabpanel"
        aria-labelledby={mode === "request" ? "studio-request-tab" : "studio-quote-tab"}
        className={styles.recordPanel}>
        <div className={styles.recordPicker}>
          <label htmlFor="studio-record-select">
            {mode === "request" ? "Saved service request" : "Saved customer quote"}
          </label>
          <select id="studio-record-select" className={styles.select}
            value={selected?.id ?? ""}
            onChange={event => mode === "request"
              ? setRequestId(event.target.value) : setQuoteId(event.target.value)}>
            <option value="">Choose an authorized saved record</option>
            {(mode === "request" ? requests : quotes).map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          {selected ? (
            <Link href={buildStaffModuleHref(workspaceSlug, mode === "request" ? "requests" : "quotes") +
              (mode === "request" ? "?request=" : "?quote=") + encodeURIComponent(selected.id)}
              className={styles.contextLink}>Review source record →</Link>
          ) : null}
        </div>
        {selected && mode === "request" ? (
          <AiRequestBrief key={workspaceSlug + ":" + selected.id}
            workspaceSlug={workspaceSlug} requestId={selected.id} configured={configured} />
        ) : null}
        {selected && mode === "quote" ? (
          <AiQuoteReview key={workspaceSlug + ":" + selected.id}
            workspaceSlug={workspaceSlug} quoteId={selected.id} configured={configured} />
        ) : null}
        {!selected ? (
          <div className={styles.emptyState} role="status">
            <strong>{mode === "request" ? "Start with an actual enquiry" : "Start with an approved business record"}</strong>
            <p>{mode === "request"
              ? requests.length ? "Select a request to see its AI intake actions." : "No saved requests are available in this view. Record a customer enquiry first."
              : quotes.length ? "Select a quote to review it with AI." : "No saved quotes are available in this view. Prepare and save a quote first."}</p>
            <Link href={buildStaffModuleHref(workspaceSlug, mode === "request" ? "requests" : "quotes")}>
              {mode === "request" ? "Go to requests →" : "Go to quotes →"}
            </Link>
          </div>
        ) : null}
      </div>
      <p className={styles.boundary}>No raw customer note, contact, address, invoice amount or API key is passed to this client workbench. AI output remains a draft; it cannot approve a quote, send a message or change a payment.</p>
    </section>
  );
}
