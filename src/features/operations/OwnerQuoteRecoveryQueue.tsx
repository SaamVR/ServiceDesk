import Link from "next/link";
import { readOwnerQuoteRecoverySummary } from "@/server/workflows/owner-quote-recovery-queue";
import { buildStaffModuleHref } from "./staff-modules";
import { summarizeOwnerRecoveryReview } from "./owner-quote-recovery-guide";
import styles from "./OwnerQuoteRecoveryQueue.module.css";

const states = [
  ["PENDING", "Queued", "Awaiting eligible processing"],
  ["PROCESSING", "Leased", "Claim exists; live worker not confirmed"],
  ["RETRY_PENDING", "Retry pending", "Scheduled, not executed"],
  ["DEAD_LETTER", "Needs review", "Human investigation required"],
  ["SUCCEEDED", "Completed", "Internal source state only"],
  ["SKIPPED", "Skipped", "Saved decision, not delivered"],
] as const;

/** Owner-only read-only internal queue evidence; no worker action or mutation.
 * Existing server reader reauthorizes workspace + owner and never returns
 * source event/customer IDs to the browser.
 */
export async function OwnerQuoteRecoveryQueue({ workspaceSlug }: { workspaceSlug: string }) {
  const proof = await readOwnerQuoteRecoverySummary(workspaceSlug);
  if (proof.state === "OWNER_REQUIRED") return null;
  const guidance = summarizeOwnerRecoveryReview(proof);
  const automationHref = buildStaffModuleHref(workspaceSlug, "automations");
  return (
    <section aria-label="Saved accepted quote source recovery" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Internal queue evidence · read only</p>
          <h3>Saved quote-acceptance recovery</h3>
          <p>Observe tenant-scoped quote event processing and examine exceptions before
            taking action. This panel cannot activate or retry a worker.</p>
        </div>
        <span className={styles.source}>
          {proof.state === "AVAILABLE" ? "Saved database counts" : "Source unavailable"}
        </span>
      </header>
      {proof.state !== "AVAILABLE" ? (
        <div className={styles.unavailable} role="status">
          <strong>Recovery queue cannot be verified</strong>
          <p>Queue data is unavailable or migration 0063 is not yet installed.
            This is <strong>not</strong> evidence of an empty queue or an active worker.</p>
          <Link href={automationHref}>Review the Automation workspace →</Link>
        </div>
      ) : (
        <>
          <dl className={styles.metrics} aria-label="Verified persisted queue state counts">
            {states.map(([state,label,description]) => (
              <div key={state} className={styles.metric}>
                <dt>{label}</dt>
                <dd>{proof.counts[state]}</dd>
                <p>{description}</p>
              </div>
            ))}
          </dl>
          <div aria-label="Internal recovery backlog" className={styles.health}>
            <p role="status">
              <strong>{proof.health.dueNow}</strong> due now
              <span>Pending or retry-ready event count; a running worker is not verified.</span>
            </p>
            <p role={proof.health.expiredLeases > 0 ? "alert" : "status"}>
              <strong>{proof.health.expiredLeases}</strong> expired leases
              <span>These claims may need reviewed retry or investigation.</span>
            </p>
          </div>
          <section className={styles.actions} aria-label="Saved recovery items for human review">
            <div className={styles.actionsHead}>
              <h4>Owner review priorities</h4>
              <small>Derived only from saved aggregate counts</small>
            </div>
            {guidance.length ? <ol>
              {guidance.map((item) => <li key={item.id} className={styles.action}>
                <span className={item.level === "danger" ? styles.danger : styles.warning}>
                  {item.count} requiring review
                </span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <Link href={automationHref}>
                  Inspect authorized workflow evidence →
                </Link>
              </li>)}
            </ol> : (
              <p className={styles.empty} role="status">
                No due, dead-letter or expired-lease items in this aggregate read.
                Other unresolved operations may still exist.
              </p>
            )}
          </section>
          <p className={styles.disclosure}>
            Counts come from saved, tenant-scoped internal source records only.
            Completed events do not prove a customer message, external provider
            delivery, payment, or automatic scheduler execution. Counts are
            a point-in-time read without a persisted timestamp in this response;
            inspecting the workflow records is required before retrying anything.
          </p>
        </>
      )}
    </section>
  );
}
