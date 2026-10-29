import Link from "next/link";
import { buildStaffModuleHref } from "./staff-modules";
import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { summarizeAutomationActivation } from "./owner-automation-activation";
import { summarizeOwnerAttentionTriage } from "./owner-attention-triage";
import { planOwnerAttentionReviewPlaybook } from "./owner-attention-review-playbook";
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
  const attention = summarizeOwnerAttentionTriage(data);
  const playbook = planOwnerAttentionReviewPlaybook(attention);
  // The real first-run pricing form is on Settings, below the general
  // configuration panels. Deep-link only when it is actually offered to
  // this authorized owner/branch; never lead to a missing or foreign form.
  const canOpenPricingForm = availableFirstRunUsdBranches(
    data.branchScope, data.ownerPricingBookProof,
  ).length > 0;
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
                (canOpenPricingForm && step.status !== "READY"
                  ? "#owner-first-run-pricing" : "")
              : buildStaffModuleHref(workspaceSlug, step.module)}>
              {step.module === "requests" ? "Review customer requests"
                : step.module === "automations" ? "Open Automation Studio"
                : canOpenPricingForm && step.status !== "READY"
                  ? "Enter actual cleaning rates" : "Open Settings"}
              <span aria-hidden="true"> ↗</span>
            </Link>
          </article>
        ))}
      </div>
      <section className={styles.attentionTriage} aria-labelledby="owner-attention-triage-title">
        <div className={styles.attentionHeader}>
          <div>
            <p className={styles.eyebrow}>Owner operations · branch-scoped saved evidence</p>
            <h3 id="owner-attention-triage-title">Internal attention review priorities</h3>
          </div>
          <Link href={buildStaffModuleHref(workspaceSlug, "automations")}>
            Inspect workflow activity
          </Link>
        </div>
        {attention.state === "UNVERIFIED" ? (
          <p role="status" className={styles.attentionNotice}>
            Authorized workflow, branch or attention data is unavailable.
            This is not evidence of an empty or healthy attention queue.
          </p>
        ) : (
          <>
            <p className={styles.attentionNotice} role="status">
              {attention.open} unresolved saved workflow attention item(s);
              {" "}{attention.overdue} past due, {attention.critical} critical,
              {" "}{attention.missingActionEvidence} lacking current saved internal-action success.
              {attention.ambiguous > 0 ? ` ${attention.ambiguous} ambiguous item(s) require inspection.` : ""}
            </p>
            {attention.review.length ? <ol className={styles.attentionList}>
              {attention.review.map(item => <li key={item.id}>
                <strong>{item.severity} · {item.state.replaceAll("_", " ")}</strong>
                <p>{item.guidance}</p>
              </li>)}
            </ol> : (
              <p className={styles.attentionNotice}>No unresolved linked workflow attention
                appears in this loaded branch-scoped sample; other queues may still require review.</p>
            )}
          </>
        )}
        <section aria-labelledby="owner-attention-playbook-title">
          <h4 id="owner-attention-playbook-title">Manual attention review playbook</h4>
          {playbook.steps.length > 0 ? <ol className={styles.attentionList}>
            {playbook.steps.map(step => <li key={step.id}>
              <strong>{step.title}{step.count === null ? "" : ` · ${step.count} record(s)`}</strong>
              <p>{step.reason}</p>
            </li>)}
          </ol> : <p className={styles.attentionNotice}>
            No unresolved linked workflow attention appears in this sample. Review other
            operational queues independently; this is not an all-clear.
          </p>}
          <p className={styles.attentionDisclosure}>{playbook.disclosure}</p>
          <Link href={buildStaffModuleHref(workspaceSlug, "automations")}>
            Review saved workflow activity
          </Link>
        </section>
        <p className={styles.attentionDisclosure}>
          Read-only snapshot, not a retry control or proof of delivery.
          Attention records are linked to authorized LIVE executions; no customer
          sends, provider actions, payments or rule publications occur here.
        </p>
      </section>
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
