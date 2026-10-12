import Link from "next/link";
import { Panel, SectionHeader, StatusBadge } from "@/components/product/PagePrimitives";
import { buildStaffModuleHref } from "@/features/operations/staff-modules";
import type { OperationalStaffSnapshot } from "@/features/operations/operational-product-runtime";
import { summarizeOwnerOperationalEvidence } from "./owner-operational-evidence";

/**
 * Shows only currently persisted owner-authorized snapshot evidence.
 * It deliberately does not say a complete flow, email or WhatsApp delivery
 * has passed UAT merely because individual database records exist.
 */
export function OnboardingOperationalEvidencePanel({
  workspaceSlug,
  snapshot,
}: {
  workspaceSlug: string;
  snapshot: Pick<OperationalStaffSnapshot,
    "requests" | "quotes" | "visits" | "invoices" | "branchScope" |
    "workflowAvailable" | "workflowExecutions" | "workflowActionExecutions">;
}) {
  const evidence = summarizeOwnerOperationalEvidence(snapshot);
  const steps = [
    { name: "Saved cleaning requests", value: evidence.savedRequests, module: "requests" as const,
      detail: "Real saved enquiries available in this authorized snapshot" },
    { name: "Priced quotes sent", value: evidence.sentQuotes, module: "quotes" as const,
      detail: "Saved quotes linked to visible requests and valid currency amounts" },
    { name: "Customer-accepted quotes", value: evidence.acceptedQuotes, module: "quotes" as const,
      detail: "Saved accepted status—not a confirmed payment" },
    { name: "Scheduled or recorded visits", value: evidence.recordedVisits, module: "jobs" as const,
      detail: "Visits linked to a saved accepted quote and request" },
    { name: "Recorded invoices", value: evidence.savedInvoices, module: "invoices" as const,
      detail: "Invoices linked to an accepted quote—not a payment receipt" },
    { name: "Linked cleaning journeys", value: evidence.linkedJourneys, module: "jobs" as const,
      detail: "Unique accepted quotes linked to a saved request, visit and invoice. Not proof of authenticated end-to-end acceptance or payment" },
    { name: "Live internal attention executions", value: evidence.completedInternalAttention,
      module: "automations" as const,
      detail: "Completed, saved LIVE QUOTE_ACCEPTED attention actions only; previews excluded" },
  ];
  return (
    <Panel>
      <SectionHeader
        title="Real operational evidence"
        description="Use the saved records below to walk through a real cleaning operation. These counts reflect this authorized snapshot, not a certified end-to-end test or customer-provider delivery."
      />
      <div className="app-row-list">
        {steps.map(step => (
          <article className="app-row" key={step.name}>
            <div>
              <h3>{step.name}</h3>
              <p>{step.detail}</p>
              <Link href={buildStaffModuleHref(workspaceSlug, step.module)}>
                Open {step.module} →
              </Link>
            </div>
            <div className="app-row-meta">
              {step.value === null ? (
                <StatusBadge tone="warning">Not verified</StatusBadge>
              ) : step.value > 0 ? (
                <StatusBadge tone="success">{step.value} recorded</StatusBadge>
              ) : (
                <StatusBadge tone="warning">No record yet</StatusBadge>
              )}
            </div>
          </article>
        ))}
      </div>
      <p style={{ fontSize: ".78rem", margin: "15px 0 0", lineHeight: 1.6 }}>
        Even a linked record chain is not confirmation that one real customer session completed the workflow.
        External WhatsApp, email, Stripe and AI-model delivery need their own
        approved provider receipts. Missing automation data is shown as unverified,
        never silently treated as a successful run.
      </p>
    </Panel>
  );
}
