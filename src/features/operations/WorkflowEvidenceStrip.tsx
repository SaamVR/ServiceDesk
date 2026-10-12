import { summarizeWorkflowEvidence } from "./workflow-evidence-summary";
import type {
  OperationalWorkflowActionExecution,
  OperationalWorkflowExecution,
} from "./operational-product-runtime";
import styles from "./WorkflowEvidenceStrip.module.css";

export function WorkflowEvidenceStrip({executions,actions}: {
  executions: readonly OperationalWorkflowExecution[];
  actions: readonly OperationalWorkflowActionExecution[];
}) {
  const evidence = summarizeWorkflowEvidence({
    workflowExecutions: executions,
    workflowActionExecutions: actions,
  });
  const issues = evidence.failedActions + evidence.externalApprovalRequired;
  return (
    <section className={styles.panel} aria-labelledby="workflow-evidence-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Authorized workspace · persisted records</p>
          <h2 id="workflow-evidence-title" className={styles.heading}>Automation activity</h2>
        </div>
        <span className={styles.badge}>Database evidence · not provider delivery</span>
      </header>
      <div className={styles.metrics} aria-label="Persisted workflow execution counts">
        <div className={styles.metric}>
          <span className={styles.label}>Recorded live rule decisions</span>
          <strong className={styles.value}>{evidence.recordedLiveExecutions}</strong>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Internal attention actions completed</span>
          <strong className={styles.value}>{evidence.internalAttentionSucceeded}</strong>
        </div>
        <div className={`${styles.metric} ${evidence.externalApprovalRequired ? styles.warn : ""}`}>
          <span className={styles.label}>External actions needing owner approval</span>
          <strong className={styles.value}>{evidence.externalApprovalRequired}</strong>
        </div>
        <div className={`${styles.metric} ${evidence.failedActions ? styles.danger : ""}`}>
          <span className={styles.label}>Failed action records</span>
          <strong className={styles.value}>{evidence.failedActions}</strong>
        </div>
      </div>
      <p className={styles.note}>
        {evidence.recordedLiveExecutions === 0
          ? "No live workflow execution records exist in this authorized branch scope yet. A draft or simulated preview is not a live event."
          : `${evidence.matchedLiveExecutions} live decisions matched published rules. ${evidence.previewExecutions} additional preview decisions are excluded from live totals.`}
        {" "}
        <strong>{issues ? "Review failed and approval-required items before any outbound action." :
          "Zero issues here does not establish external delivery."}</strong>
        {" "}Provider sends, email delivery, WhatsApp delivery, checkout and model inference require separate controlled receipts.
        {evidence.internalAttentionPending > 0
          ? ` ${evidence.internalAttentionPending} internal attention action(s) remain pending.`
          : null}
        {evidence.approvedExternalPending > 0
          ? ` ${evidence.approvedExternalPending} external action(s) are queued or approved; delivery remains unverified.`
          : null}
      </p>
    </section>
  );
}
