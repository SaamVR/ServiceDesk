"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AiRequestBrief } from "./AiRequestBrief";
import { AiQuoteReview } from "./AiQuoteReview";
import { AiSavedIntakeReview } from "./AiSavedIntakeReview";
import { AiGroundedQuoteAlternatives } from "./AiGroundedQuoteAlternatives";
import { AiSavedCapacityReview } from "./AiSavedCapacityReview";
import { AiSavedBusinessReview } from "./AiSavedBusinessReview";
import { buildStaffModuleHref } from "./staff-modules";
import { filterStudioRecordChoices } from "./ai-studio-records";
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
  const [recordSearch, setRecordSearch] = useState("");
  const tabsId = useId();
  const requestTabRef = useRef<HTMLButtonElement>(null);
  const quoteTabRef = useRef<HTMLButtonElement>(null);
  const recordSelectRef = useRef<HTMLSelectElement>(null);
  const activateTab = (next: "request" | "quote") => {
    setMode(next);
    setRecordSearch("");
  };
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: "request" | "quote" | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft")
      next = mode === "request" ? "quote" : "request";
    else if (event.key === "Home") next = "request";
    else if (event.key === "End") next = "quote";
    if (!next) return;
    event.preventDefault();
    activateTab(next);
    (next === "request" ? requestTabRef : quoteTabRef).current?.focus();
  };
  // Never submit or display an arbitrary record ID: selectors are filled only
  // from the current authenticated, branch-scoped server snapshot.
  const selectedRequest = requests.find(item => item.id === requestId);
  const selectedQuote = quotes.find(item => item.id === quoteId);
  const selected = mode === "request" ? selectedRequest : selectedQuote;
  const clearSelectedRecord = () => {
    // Unmount the active AI panel so its outstanding request is cancelled
    // in this browser; server/provider cancellation is NOT implied.
    if (mode === "request") setRequestId("");
    else setQuoteId("");
    setRecordSearch("");
    recordSelectRef.current?.focus();
  };
  const choices = mode === "request" ? requests : quotes;
  const matches = filterStudioRecordChoices(choices, recordSearch);
  // Preserve a selected authorized item when staff starts a new search;
  // otherwise the controlled select may show blank while a review is visible.
  const visibleChoices = selected && !matches.some(item => item.id === selected.id)
    ? [selected, ...matches] : matches;

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
          aria-controls={tabsId + "-panel"} id={tabsId + "-request"} ref={requestTabRef}
          tabIndex={mode === "request" ? 0 : -1} onKeyDown={onTabKeyDown}
          className={mode === "request" ? styles.tabActive : styles.tab}
          onClick={() => activateTab("request")}>Request intelligence</button>
        <button type="button" role="tab" aria-selected={mode === "quote"}
          aria-controls={tabsId + "-panel"} id={tabsId + "-quote"} ref={quoteTabRef}
          tabIndex={mode === "quote" ? 0 : -1} onKeyDown={onTabKeyDown}
          className={mode === "quote" ? styles.tabActive : styles.tab}
          onClick={() => activateTab("quote")}>Quote review</button>
      </div>

      <div id={tabsId + "-panel"} role="tabpanel" tabIndex={0}
        aria-labelledby={mode === "request" ? tabsId + "-request" : tabsId + "-quote"}
        className={styles.recordPanel}>
        <div className={styles.searchRow}>
          <label htmlFor={tabsId + "-search"}>Find saved {mode === "request" ? "requests" : "quotes"}</label>
          <input id={tabsId + "-search"} type="search" autoComplete="off"
            className={styles.searchInput} value={recordSearch} maxLength={80}
            placeholder="Search record label or ID"
            aria-describedby={tabsId + "-search-hint"}
            onChange={event => setRecordSearch(event.target.value)}
            onKeyDown={event => {
              // No arbitrary IDs: Enter only chooses one already-authorized
              // result from the current, capped browser-side record list.
              if (event.key !== "Enter" || matches.length !== 1) return;
              event.preventDefault();
              const id = matches[0].id;
              if (mode === "request") setRequestId(id);
              else setQuoteId(id);
              recordSelectRef.current?.focus();
            }} />
          {recordSearch ? <button type="button" className={styles.clearSearch}
            onClick={() => setRecordSearch("")} aria-label="Clear saved-record search">
            Clear search
          </button> : null}
          <span role="status" aria-live="polite" className={styles.searchCount}
            id={tabsId + "-search-hint"}>
            {matches.length} of {choices.length} loaded record choices shown
            {matches.length === 1 ? " · Press Enter to select this saved record" : ""}
          </span>
        </div>
        <div className={styles.recordPicker}>
          <label htmlFor={tabsId + "-record-select"}>
            {mode === "request" ? "Saved service request" : "Saved customer quote"}
          </label>
          <select id={tabsId + "-record-select"} className={styles.select}
            ref={recordSelectRef}
            value={selected?.id ?? ""}
            onChange={event => mode === "request"
              ? setRequestId(event.target.value) : setQuoteId(event.target.value)}>
            <option value="">Choose an authorized saved record</option>
            {visibleChoices.map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          {selected ? <button type="button" className={styles.clearSelection}
            onClick={clearSelectedRecord} aria-label={"Clear selected " + mode + " record"}>
            Clear selected record
          </button> : null}
          {selected ? (
            <Link href={buildStaffModuleHref(workspaceSlug, mode === "request" ? "requests" : "quotes") +
              (mode === "request" ? "?request=" : "?quote=") + encodeURIComponent(selected.id)}
              className={styles.contextLink}>Review source record →</Link>
          ) : null}
        </div>
        {choices.length >= 40 ? (
          <p role="note" className={styles.scopeNotice}>
            Search is limited to the 40 saved {mode === "request" ? "requests" : "quotes"}
            supplied in this authorized view. Results are not a complete database search.{" "}
            <Link href={buildStaffModuleHref(workspaceSlug,
              mode === "request" ? "requests" : "quotes")}>
              Open {mode === "request" ? "Requests" : "Quotes"} to find other records →
            </Link>
          </p>
        ) : null}
        {choices.length > 0 && matches.length === 0 ? (
          <p className={styles.searchNoMatch} role="status">
            No authorized records match this search. Clear the search to see available records.
            {selected ? " Your previously selected record remains available." : ""}
          </p>
        ) : null}
        {selected && mode === "request" ? (
          <div key={workspaceSlug + ":" + selected.id + ":" + selected.label}>
            <AiRequestBrief
              workspaceSlug={workspaceSlug} requestId={selected.id} configured={configured} />
            <AiSavedIntakeReview workspaceSlug={workspaceSlug} requestId={selected.id} />
            <AiGroundedQuoteAlternatives workspaceSlug={workspaceSlug} requestId={selected.id} />
          </div>
        ) : null}
        {selected && mode === "quote" ? (
          <AiQuoteReview key={workspaceSlug + ":" + selected.id + ":" + selected.label}
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
      <section className={styles.recordPanel} aria-label="Verified model-free operations assistants">
        <h2>Verified operational assistants</h2>
        <p>These actions recheck signed-in saved records on demand. They do not require a model connection or create business actions.</p>
        <AiSavedCapacityReview workspaceSlug={workspaceSlug} />
        <AiSavedBusinessReview workspaceSlug={workspaceSlug} />
        <p className={styles.boundary}>Crew review is limited to authorized owners or dispatchers. Daily/weekly intelligence is owner-only and will refuse other roles. All suggestions require manual verification.</p>
      </section>
      <p className={styles.boundary}>Review source facts again whenever saved record details change.
        Visible status changes discard old client-only AI suggestions; edits that preserve
        the same status still require a fresh authorized backend check.
      </p>
      <p className={styles.boundary}>No raw customer note, contact, address, invoice amount or API key is passed to this client workbench. AI output remains a draft; it cannot approve a quote, send a message or change a payment.</p>
    </section>
  );
}
