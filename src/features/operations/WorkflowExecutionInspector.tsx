"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkflowInspectorClientSnapshot } from "./workflow-inspector-client-snapshot";
import {
  buildWorkflowInspector,
  isWorkflowAttentionRequired,
  summarizeWorkflowActivity,
} from "./workflow-inspector-model";
import { buildStaffModuleHref } from "./staff-modules";
import styles from "./WorkflowExecutionInspector.module.css";

type Snapshot = WorkflowInspectorClientSnapshot;
type Filter = "all" | "attention" | "failed" | "completed";
const filters: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "All recorded" },
  { value: "attention", label: "Needs attention" },
  { value: "failed", label: "Failures" },
  { value: "completed", label: "Completed" },
];

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, first => first.toUpperCase());
}

export function WorkflowExecutionInspector({ snapshot, workspaceSlug }: {
  snapshot: Snapshot;
  workspaceSlug: string;
}) {
  const runs = buildWorkflowInspector(snapshot);
  const summary = summarizeWorkflowActivity(runs);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const matching = runs.filter(run =>
    filter === "all" ||
    (filter === "attention" && isWorkflowAttentionRequired(run)) ||
    (filter === "failed" && (run.state === "PARTIAL_FAILED" || run.failedCount > 0)) ||
    (filter === "completed" && run.state === "COMPLETED"));
  const visible = matching.slice(0, visibleCount);
  const selected = visible.find(run => run.id === selectedId) ?? visible[0];
  const averageDuration = summary.measuredDurationMs.length
    ? Math.round(summary.measuredDurationMs.reduce((a, b) => a + b, 0) / summary.measuredDurationMs.length / 1000)
    : null;

  return <section className={styles.panel} aria-label="Recorded automation activity"
    data-testid="workflow-execution-inspector">
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Automation command center</p>
        <h2>Workflow activity &amp; action evidence</h2>
        <p className={styles.subtle}>Recent authorized snapshot, not real-time monitoring or complete historical reporting.
          The source loads at most 1,000 workflow executions and 2,000 action-attempt rows
          before branch scoping. Preview runs and inferred delivery claims are excluded.</p>
      </div>
      <span className={styles.snapshot}>Snapshot recorded: <time dateTime={snapshot.loadedAt}>{snapshot.loadedAt}</time></span>
    </header>

    {snapshot.workflowAvailable === true ? <div className={styles.metrics} aria-label="Saved automation effectiveness metrics">
      <div><strong>{summary.runs}</strong><span>Live decisions in loaded snapshot</span></div>
      <div><strong>{summary.recordedSucceededActions}</strong><span>Internally succeeded in loaded actions</span></div>
      <div><strong>{summary.waitingForApproval}</strong><span>Current approvals in loaded actions</span></div>
      <div><strong>{summary.failed}</strong><span>Loaded runs with recorded failures</span></div>
      <div><strong>{summary.pendingActions}</strong><span>Pending states in loaded actions</span></div>
      <div><strong>{averageDuration === null ? "—" : `${averageDuration}s`}</strong>
        <span>Mean recorded run duration ({summary.measuredDurationMs.length} complete pairs)</span></div>
    </div> : null}

    {snapshot.workflowAvailable !== true
      ? <p className={styles.notice} role="status">Workflow evidence is unavailable for this authorized snapshot. No activity can be inferred.</p>
      : !runs.length
      ? <p className={styles.notice} role="status">No live executions were returned in the current authorized snapshot.
        Publish an authorized automation and trigger it through ordinary business operations to generate real evidence.</p>
      : <>
        <nav className={styles.filters} aria-label="Filter workflow executions">
          {filters.map(item => <button key={item.value} type="button"
            className={filter === item.value ? styles.filterActive : styles.filter}
            aria-pressed={filter === item.value}
            onClick={() => { setFilter(item.value); setSelectedId(""); setVisibleCount(20); }}>
            {item.label}
          </button>)}
        </nav>
        {!matching.length ? <p className={styles.notice} role="status">No recorded executions match this filter.</p>
        : <div className={styles.grid}>
          <div className={styles.list} role="group" aria-label="Choose workflow execution">
            {visible.map(run => <button key={run.id} type="button"
              className={selected?.id === run.id ? styles.selected : styles.item}
              onClick={() => setSelectedId(run.id)} aria-pressed={selected?.id === run.id}>
              <strong>{humanize(run.eventType)}</strong>
              <small>{humanize(run.state)} · <time dateTime={run.createdAt}>{run.createdAt}</time></small>
              <small>{run.actions.length} current actions · {run.failedCount} failed · {run.pendingCount} pending</small>
            </button>)}
            {visible.length < matching.length ? <button type="button" className={styles.more}
              onClick={() => setVisibleCount(current => current + 20)}>
              Show more ({matching.length - visible.length} remaining)
            </button> : null}
          </div>
          {selected ? <article className={styles.detail} aria-label="Selected execution evidence" aria-live="polite">
            <div className={styles.detailHead}>
              <div><p className={styles.eyebrow}>Persisted execution</p><h3>{humanize(selected.eventType)}</h3></div>
              <span className={styles.state}>{humanize(selected.state)}</span>
            </div>
            <dl className={styles.facts}>
              <div><dt>Execution ID</dt><dd>{selected.id}</dd></div>
              <div><dt>Rule version</dt><dd>{selected.versionNumber ?? "Unverified"}</dd></div>
              <div><dt>Rule identity</dt><dd>{selected.ruleEvidence}</dd></div>
              <div><dt>Condition result</dt><dd>{selected.matched ? "Matched" : "Not matched"}</dd></div>
              <div><dt>Saved action attempts</dt><dd>{selected.attemptCount}</dd></div>
              <div><dt>Completion timestamp</dt><dd>{selected.completedAt ?? "Not recorded"}</dd></div>
            </dl>

            <h4>Evidence-backed workflow stages</h4>
            <ol className={styles.stages}>
              <li><strong>Event</strong><span>{humanize(selected.eventType)} — saved</span></li>
              <li><strong>Context</strong><span>{selected.sourceQuoteId
                ? "Quote identity linked by the server" : "Linked source record not independently proven"}</span></li>
              <li><strong>AI</strong><span>{selected.aiEvidence}</span></li>
              <li><strong>Conditions</strong><span>{selected.matched ? "Matched" : "Not matched"}
                {selected.versionNumber !== undefined ? ` · rule v${selected.versionNumber}` : " · rule not verified"}</span></li>
              <li><strong>Approval</strong><span>{selected.approvalCount > 0
                ? `${selected.approvalCount} current action(s) require approval`
                : selected.actions.some(action => Boolean(action.approvedAt))
                ? "Approval timestamp recorded on an action" : "No approval evidence in latest action states"}</span></li>
              <li><strong>Action</strong><span>{selected.actions.length
                ? `${selected.actions.length} current persisted action states` : "No action attempt recorded"}</span></li>
              <li><strong>Result</strong><span>{humanize(selected.state)} — persisted workflow state</span></li>
            </ol>

            {selected.sourceQuoteId ? <Link className={styles.sourceLink}
              href={buildStaffModuleHref(workspaceSlug, "quotes") +
                "?quote=" + encodeURIComponent(selected.sourceQuoteId)}>
              Open linked saved quote →
            </Link> : null}

            <h4>Current action state and attempt history</h4>
            {selected.actions.length ? <ol className={styles.actions}>
              {selected.actions.map(action => <li key={action.id}>
                <strong>{humanize(action.actionType)} — {humanize(action.state)}</strong>
                <span>Action {action.actionIndex + 1} · Attempt {action.attemptNumber}</span>
                {action.errorCode ? <span>Recorded failure code: {action.errorCode}</span> : null}
                {action.approvedAt ? <span>Approval timestamp: {action.approvedAt}</span> : null}
                {action.completedAt ? <span>Action completion timestamp: {action.completedAt}</span> : null}
                {action.replayOfActionExecutionId ? <span>Replay of saved attempt: {action.replayOfActionExecutionId}</span> : null}
              </li>)}
            </ol> : <p className={styles.notice}>No persisted action attempts. A matched rule does not prove execution.</p>}
            {selected.attemptHistory.length > 0 ? (
              <details className={styles.history}>
                <summary>Inspect all {selected.attemptHistory.length} persisted action attempts</summary>
                <p className={styles.subtle}>History is limited to rows returned in this saved snapshot.
                  An earlier failed attempt remains visible even when a later replay succeeds.</p>
                <ol className={styles.actions}>
                  {selected.attemptHistory.map(attempt => <li key={attempt.id}>
                    <strong>{humanize(attempt.actionType)} — {humanize(attempt.state)}</strong>
                    <span>Action {attempt.actionIndex + 1} · Attempt {attempt.attemptNumber}
                      {selected.actions.some(latest => latest.id === attempt.id) ? " · current" : " · historical"}</span>
                    <span>Recorded: {attempt.createdAt}</span>
                    {attempt.errorCode ? <span>Failure code: {attempt.errorCode}</span> : null}
                    {attempt.approvedAt ? <span>Approval at: {attempt.approvedAt}</span> : null}
                    {attempt.completedAt ? <span>Completed at: {attempt.completedAt}</span> : null}
                    {attempt.replayOfActionExecutionId ? <span>Replay source: {attempt.replayOfActionExecutionId}</span> : null}
                  </li>)}
                </ol>
              </details>
            ) : null}
            <p className={styles.subtle}>Recorded SUCCEEDED means the internal action state only.
              External email/WhatsApp delivery, AI response and downstream customer outcome
              require separate provider evidence. Recovery must use authorized operational controls.</p>
          </article> : null}
        </div>}
      </>}
  </section>;
}
