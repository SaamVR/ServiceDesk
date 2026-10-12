import Link from "next/link";
import { buildStaffModuleHref } from "./staff-modules";
import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { summarizeAutomationActivation } from "./owner-automation-activation";
import styles from "./OwnerAutomationActivationChecklist.module.css";

/**
 * A signed-in, owner-only operational readiness readout. The parent route
 * verifies membership and passes a tenant-scoped persisted snapshot.
 */
export function OwnerAutomationActivationChecklist({
  data,
  workspaceSlug,
}: {
  data: OperationalStaffSnapshot;
  workspaceSlug: string;
}) {
  const summary = summarizeAutomationActivation(data);
  return (
    <section className={styles.panel} aria-labelledby="owner-activation-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Owner activation · saved workspace evidence</p>
          <h2 id="owner-activation-title">Prepare your quote-to-action workflow</h2>
          <p>Complete these operational prerequisites before testing automatic follow-up with real customers.</p>
        </div>
        <div className={styles.progress} aria-label={`${summary.readyCount} of ${summary.total} checks ready`}>
          <strong>{summary.readyCount}<span> / {summary.total}</span></strong>
          <small>Evidence ready</small>
        </div>
      </header>
      <div className={styles.grid}>
        {summary.steps.map((step, index) => (
          <article className={styles.step} key={step.id}>
            <div className={styles.top}>
              <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className={
                step.status === "READY" ? styles.ready
                  : step.status === "UNVERIFIED" ? styles.unverified : styles.action
              }>
                {step.status === "READY" ? "Verified" :
                  step.status === "UNVERIFIED" ? "Unavailable" : "Action needed"}
              </span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <Link href={buildStaffModuleHref(workspaceSlug, step.module)}>
              {step.module === "settings" ? "Open Settings" : "Open Automation Studio"}
              <span aria-hidden="true"> ↗</span>
            </Link>
          </article>
        ))}
      </div>
      <p className={styles.disclosure} role="note">
        {summary.allEvidenceReady
          ? "The four workspace prerequisites are evidenced. Real session acceptance, deployment opt-in and provider delivery still require independent checks."
          : "These checks are based on saved workspace records—not a demo, a model configuration flag, or provider-delivery proof."}
        {" "}Email, WhatsApp, scheduling and payments are never activated by this checklist.
      </p>
    </section>
  );
}
