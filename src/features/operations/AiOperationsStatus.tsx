import Link from "next/link";
import { buildStaffModuleHref } from "./staff-modules";
import { readConfiguredAiRuntimeConfig } from "@/server/ai/runtime-config";
import styles from "./AiOperationsStatus.module.css";
import { AiOwnerModelProbe } from "./AiOwnerModelProbe";
import { summarizeWorkflowEvidence } from "./workflow-evidence-summary";
import type { OperationalWorkflowExecution, OperationalWorkflowActionExecution } from "./operational-product-runtime";

export function AiOperationsStatus({
  workspaceSlug, publishedRuleCount, compact = false, allowOwnerModelTest = false,
  executions, actions,
}: {
  workspaceSlug: string;
  publishedRuleCount: number;
  compact?: boolean;
  allowOwnerModelTest?: boolean;
  executions?: readonly OperationalWorkflowExecution[];
  actions?: readonly OperationalWorkflowActionExecution[];
}) {
  const ready = readConfiguredAiRuntimeConfig().ok;
  // A partial or failed snapshot must not be rendered as a trustworthy zero.
  const evidence = executions && actions
    ? summarizeWorkflowEvidence({ workflowExecutions: executions, workflowActionExecutions: actions })
    : undefined;
  return (
    <section className={styles.panel} aria-label="AI and automation operating status">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>AI & automation workspace</p>
          <h2>Turn enquiries into reviewed next steps</h2>
          <p>Generate staff-only intake briefs, review AI replies, and configure event-driven workflows—without hidden customer sends or payments.</p>
        </div>
        <span className={ready ? styles.configured : styles.unconfigured}>
          {ready ? "AI configured · provider proof pending" : "AI not enabled"}
        </span>
      </div>
      <div className={styles.grid}>
        <div>
          <strong>01 · AI intake copilot</strong>
          <p>Summarize a persisted cleaning request and identify missing information. A model call occurs only when explicitly requested by staff.</p>
          <Link href={buildStaffModuleHref(workspaceSlug, "requests")}>Open requests <span aria-hidden="true">↗</span></Link>
        </div>
        <div>
          <strong>02 · Human-reviewed customer replies</strong>
          <p>Propose a reply from a saved inbound conversation; staff reviews and approves the text before queueing delivery.</p>
          <Link href={buildStaffModuleHref(workspaceSlug, "inbox")}>Open inbox <span aria-hidden="true">↗</span></Link>
        </div>
        <div>
          <strong>03 · Workflow automation</strong>
          <p>{publishedRuleCount > 0
            ? `${publishedRuleCount} published rule version${publishedRuleCount === 1 ? "" : "s"} recorded. Confirm an actual event-execution receipt before calling them operational.`
            : "No published workflow versions in this workspace. Draft and preview an event → condition → action rule before publishing."}</p>
          <Link href={buildStaffModuleHref(workspaceSlug, "automations")}>Review rules <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      {compact && evidence ? (
        <div className={styles.proof} aria-label="Persisted AI and automation activity">
          <div><strong>{evidence.recordedLiveExecutions}</strong><span>Recorded live rule decisions</span></div>
          <div><strong>{evidence.internalAttentionSucceeded}</strong><span>Completed internal attention records</span></div>
          <div><strong>{evidence.externalApprovalRequired}</strong><span>External actions requiring approval</span></div>
          <div><strong>{evidence.failedActions}</strong><span>Failed action records</span></div>
          <p>Authorized database records · simulated previews excluded · no provider delivery verified.
            <Link href={buildStaffModuleHref(workspaceSlug, "automations")}> Review execution evidence →</Link>
          </p>
        </div>
      ) : null}
      {allowOwnerModelTest && !compact ? <AiOwnerModelProbe workspaceSlug={workspaceSlug} configured={ready} /> : null}
      {!compact ? (
        <>
          <p className={styles.note} role="status" aria-label="Automatic quote-accepted trigger status">
            <strong>Customer quote acceptance → internal automation:</strong>{" "}
            {process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED === "true"
              ? "Deployment switch enabled. Each workspace must separately opt in; only owner-published rules can create internal attention. Saved execution receipts are still required before claiming any workflow ran."
              : "Deployment switch disabled. Accepting a quote does not automatically run an internal follow-up. Authorized staff can review and execute published event rules from this workspace."}
            {" "}External email and WhatsApp actions always require separate approval.
          </p>
          <p className={styles.note}>AI configuration is not a successful provider connection test. AI suggestions cannot execute quotes, scheduling, outbound messages or charges.</p>
        </>
      ) : null}
    </section>
  );
}
