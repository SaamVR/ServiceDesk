import Link from "next/link";
import { buildStaffModuleHref } from "./staff-modules";
import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { summarizeAutomationActivation } from "./owner-automation-activation";
import { buildOwnerActivationNextAction } from "./owner-activation-next-action";
import { availableFirstRunUsdBranches } from "./owner-pricing-readiness";
import styles from "./OwnerAutomationActivationChecklist.module.css";
import { readConfiguredAiRuntimeConfig } from "@/server/ai/runtime-config";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { OwnerWorkflowRuleAssistant } from "./OwnerWorkflowRuleAssistant";
import { OwnerStarterBatchWorkbench } from "./OwnerStarterBatchWorkbench";

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
  // The real first-run pricing form is on Settings, below the general
  // configuration panels. Deep-link only when it is actually offered to
  // this authorized owner/branch; never lead to a missing or foreign form.
  const canOpenPricingForm = availableFirstRunUsdBranches(
    data.branchScope, data.ownerPricingBookProof,
  ).length > 0;
  const nextAction = buildOwnerActivationNextAction(summary, canOpenPricingForm);
  const nextHref = buildStaffModuleHref(workspaceSlug, nextAction.module) + nextAction.anchor;
  const settingsHref = buildStaffModuleHref(workspaceSlug, "settings");
  // Only authorized branch IDs from the already-resolved owner staff snapshot
  // cross to the client. The suggestion HTTP endpoint and what-if server action
  // each re-authorize this workspace/branch independently.
  const allowedBranches = data.branchScope?.mode === "BRANCH"
    ? (data.branchScope.branches ?? []).filter(b => b.id === data.branchScope?.selectedBranchId)
    : data.branchScope?.branches ?? [];
  const ownerRuleBranches = data.actor?.role === "OWNER"
    ? allowedBranches.filter(b =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id))
      .slice(0,24).map(b=>({id:b.id,name:b.name}))
    : [];
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
          <small>Source-linked evidence</small>
        </div>
      </header>
      <section className={styles.nextAction} aria-labelledby="owner-activation-next-action" role="region">
        <p className={styles.eyebrow}>Next owner action · saved evidence only</p>
        <h3 id="owner-activation-next-action">{nextAction.title}</h3>
        <p>{nextAction.detail}</p>
        <Link href={nextHref}>{nextAction.linkLabel}<span aria-hidden="true"> ↗</span></Link>
        <p className={styles.nextDisclosure}>Initial owner opt-in readiness:
          {" "}<strong>{nextAction.readyForOwnerOptIn ? "Prerequisites evidenced; separate deployment and owner approval still apply" : "Not yet evidenced"}</strong>.
          {" "}This panel never publishes a rule, retries a job, or sends a customer message.</p>
      </section>
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
            <Link href={step.module === "settings"
              ? settingsHref +
                (step.id === "pricing" && step.status === "ACTION_REQUIRED" &&
                 canOpenPricingForm ? "#owner-first-run-pricing" : "")
              : buildStaffModuleHref(workspaceSlug, step.module)}>
              {step.module === "requests" ? "Review customer requests"
                : step.module === "automations" ? "Open Automation Studio"
                : step.id === "pricing" && step.status === "ACTION_REQUIRED" && canOpenPricingForm
                  ? "Enter actual cleaning rates" : "Open Settings"}
              <span aria-hidden="true"> ↗</span>
            </Link>
          </article>
        ))}
      </div>
      {data.actor?.role === "OWNER" ? <OwnerWorkflowRuleAssistant
        workspaceSlug={workspaceSlug} workspaceId={data.workspace.id}
        branches={ownerRuleBranches}
        configured={readConfiguredAiRuntimeConfig().ok}
        draftWritable={data.workflowAvailable === true &&
          operationalDatabaseMode() === "SERVICE_ROLE"} /> : null}
      {data.actor?.role === "OWNER" ? <OwnerStarterBatchWorkbench
        workspaceSlug={workspaceSlug} workspaceId={data.workspace.id}
        branches={ownerRuleBranches} /> : null}
      <p className={styles.disclosure} role="note">
        {summary.allEvidenceReady
          ? "Exact saved quote-source and linked internal attention are evidenced with the other workspace prerequisites. Independent customer-session UAT, provider delivery and deployment opt-in still require separate checks."
          : "These checks are based on saved workspace records—not a demo, a model configuration flag, or provider-delivery proof."}
        {" "}Email, WhatsApp, scheduling and payments are never activated by this checklist.
      </p>
    </section>
  );
}
