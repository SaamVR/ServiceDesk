"use client";
import { useState } from "react";
import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { buildWorkflowInspector } from "./workflow-inspector-model";
import styles from "./WorkflowExecutionInspector.module.css";

export function WorkflowExecutionInspector({ snapshot }: {
  snapshot: Pick<OperationalStaffSnapshot, "workflowAvailable" | "workflowExecutions" | "workflowActionExecutions" | "workflowRuleVersions">
}) {
  const runs = buildWorkflowInspector(snapshot);
  const [selectedId, setSelectedId] = useState("");
  const selected = runs.find(run => run.id === selectedId) ?? runs[0];
  return <section className={styles.panel} aria-label="Recorded automation activity" data-testid="workflow-execution-inspector">
    <header className={styles.header}><div><p className={styles.eyebrow}>Automation observability</p>
      <h2>Recorded workflow activity</h2>
      <p className={styles.subtle}>Only saved live execution decisions; no simulated deliveries or implied AI calls.</p></div>
      <strong>{runs.length} recorded live runs</strong></header>
    {!snapshot.workflowAvailable ? <p className={styles.notice} role="status">Workflow records are unavailable for this authorized snapshot.</p> :
    !runs.length ? <p className={styles.notice} role="status">No recorded live executions. Preview runs are excluded; build and publish workflows in Automation Studio.</p> :
    <div className={styles.grid}>
      <div className={styles.list} role="group" aria-label="Choose workflow execution">
        {runs.slice(0, 40).map(run => <button type="button" key={run.id}
          className={selected?.id === run.id ? styles.selected : styles.item}
          onClick={() => setSelectedId(run.id)} aria-pressed={selected?.id === run.id}>
          <strong>{run.eventType.replaceAll("_", " ")}</strong>
          <small>{run.state.replaceAll("_", " ")} · {run.createdAt}</small>
          <small>{run.actions.length} current actions · {run.failedCount} failed · {run.pendingCount} awaiting</small>
        </button>)}
      </div>
      {selected ? <article className={styles.detail} aria-label="Selected execution evidence">
        <h3>Execution details</h3>
        <dl className={styles.facts}>
          <div><dt>Execution ID</dt><dd>{selected.id}</dd></div>
          <div><dt>Persisted status</dt><dd>{selected.state}</dd></div>
          <div><dt>Source quote</dt><dd>{selected.sourceQuoteId ?? "Not independently linked"}</dd></div>
          <div><dt>Rule version</dt><dd>{selected.versionNumber ?? "Unavailable"}</dd></div>
          <div><dt>Condition outcome</dt><dd>{selected.matched ? "Matched" : "Not matched"}</dd></div>
          <div><dt>AI involvement</dt><dd>{selected.aiEvidence}</dd></div>
          <div><dt>Attempt records</dt><dd>{selected.attemptCount}</dd></div>
          <div><dt>Completion</dt><dd>{selected.completedAt ?? "Not recorded"}</dd></div>
        </dl>
        <h3>Persisted action attempts</h3>
        {selected.actions.length ? <ol className={styles.actions}>
          {selected.actions.map(action => <li key={action.id}>
            <strong>{action.actionType.replaceAll("_"," ")} — {action.state.replaceAll("_"," ")}</strong>
            <span>Step {action.actionIndex + 1} · Attempt {action.attemptNumber}</span>
            {action.errorCode ? <span>Failure code: {action.errorCode}</span> : null}
            {action.approvedAt ? <span>Approved at {action.approvedAt}</span> : null}
            {action.completedAt ? <span>Recorded completion {action.completedAt}</span> : null}
          </li>)}
        </ol> : <p className={styles.notice}>No persisted action attempts for this execution. A matched rule alone is not proof of action.</p>}
        <p className={styles.subtle}>Status is based on saved records, not delivery receipts. Approval and provider success must be verified independently.</p>
      </article> : null}
    </div>}
  </section>;
}
