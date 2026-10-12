import Link from "next/link";
import { StaffAppShell } from "@/components/product/StaffAppShell";
import {
  EmptyState,
  MetricStrip,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
} from "@/components/product/PagePrimitives";
import { FeedbackBanner } from "@/components/product/FeedbackPrimitives";
import { loadOnboardingProduct } from "./onboarding-product-runtime";
import { summarizeOwnerCommercialSetup } from "./onboarding-commercial-readiness";

function setupState(done: boolean) {
  return done ? (
    <StatusBadge tone="success">Ready</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Needs setup</StatusBadge>
  );
}

export async function OnboardingProductRoute({
  workspaceSlug,
}: {
  workspaceSlug?: string;
}) {
  const result = await loadOnboardingProduct(workspaceSlug);

  if (!result.ok) {
    return (
      <main className="site-shell">
        <Panel>
          <FeedbackBanner
            tone={result.kind === "authentication" ? "info" : "danger"}
            title={
              result.kind === "authentication"
                ? "Sign in to continue setup"
                : result.kind === "authorization"
                  ? "Create your business workspace"
                  : "Onboarding unavailable"
            }
            description={result.message}
            action={
              result.kind === "authentication" || result.kind === "authorization" ? (
                <Link
                  className="app-button-primary"
                  href={result.kind === "authorization"
                    ? "/auth/create-workspace"
                    : "/auth/sign-in?next=" +
                    encodeURIComponent(
                      workspaceSlug
                        ? "/onboarding?workspace=" + encodeURIComponent(workspaceSlug)
                        : "/onboarding",
                    )
                  }
                >
                  {result.kind === "authorization" ? "Create workspace" : "Sign in"}
                </Link>
              ) : undefined
            }
          />
        </Panel>
      </main>
    );
  }

  const { workspace, ownerSettings, platformBilling, serviceCatalog, branchScope, ownerPricingBookProof, workflowRuleVersions } = result.value;
  // Only persisted, scope-authorized operational catalog rows establish actual
  // service setup; legacy settings labels cannot stand in for real pricing.
  const enabledServices = serviceCatalog.filter(service => service.active);
  const commercial = summarizeOwnerCommercialSetup({
    catalog: serviceCatalog, scope: branchScope, proof: ownerPricingBookProof,
  });
  const activeMembers =
    ownerSettings?.members.filter((member) => member.active) ?? [];
  const businessReady = Boolean(workspace.name && workspace.timezone);
  const servicesReady = enabledServices.length > 0;
  const teamReady = activeMembers.length > 0;
  // A recorded subscription is not necessarily usable: past-due and
  // cancelled records must never count as completed owner setup.
  const billingReady = platformBilling?.subscription.status === "ACTIVE" ||
    platformBilling?.subscription.status === "TRIALING";
  const pricingVerified = commercial.state === "VERIFIED";
  const readyCount = [businessReady, servicesReady, pricingVerified, teamReady, billingReady].filter(Boolean).length;
  const workspaceBase =
    "/app/" + encodeURIComponent(workspace.slug);

  return (
    <StaffAppShell workspace={workspace.slug}>
      <PageHeader
        eyebrow="Workspace setup"
        title="Finish setting up ServiceDesk"
        description="Check your saved services and branch prices first. These five setup signals are not a live-provider or customer-workflow certification."
        actions={
          <Link className="app-button-primary" href={workspaceBase + "/overview"}>
            Open workspace
          </Link>
        }
      />

      <MetricStrip
        items={[
          {
            label: "Setup signals verified",
            value: String(readyCount) + "/5",
            detail: "Not a launch approval",
          },
          {
            label: "Services",
            value: enabledServices.length,
            detail: "Enabled services",
          },
          {
            label: "Branch pricing",
            value: pricingVerified ? "Verified" : "Needs review",
            detail: commercial.missingPriceBookBranches
              ? `${commercial.missingPriceBookBranches} USD branch book(s) missing`
              : "Saved price-book proof",
          },
          {
            label: "Team",
            value: activeMembers.length,
            detail: "Active members",
          },
          {
            label: "Plan",
            value: platformBilling?.subscription.plan ?? "Not configured",
            detail:
              platformBilling?.subscription.status ??
              "Subscription status unavailable",
          },
        ]}
      />

      <div className="app-dashboard-grid">
        <Panel>
          <SectionHeader
            title="Core setup"
            description="Current workspace settings for this business."
          />
          <div className="app-row-list">
            <article className="app-row">
              <div>
                <h3>Business profile</h3>
                <p>{workspace.name + " · " + workspace.timezone}</p>
              </div>
              <div className="app-row-meta">{setupState(businessReady)}</div>
            </article>

            <article className="app-row">
              <div>
                <h3>Service catalog</h3>
                <p>
                  {servicesReady
                    ? String(enabledServices.length) +
                      " active service" +
                      (enabledServices.length === 1 ? "" : "s") +
                      " saved in the operational catalog."
                    : "No active service is saved. Set up the real cleaning catalog and owner-entered prices."}
                </p>
                {!servicesReady ? <Link href={workspaceBase + "/settings"}>Configure actual services →</Link> : null}
              </div>
              <div className="app-row-meta">{setupState(servicesReady)}</div>
            </article>

            <article className="app-row">
              <div>
                <h3>Branch price books</h3>
                <p>{commercial.detail}</p>
                {!pricingVerified ? (
                  <Link href={workspaceBase + "/settings"}>Review branch pricing in Settings →</Link>
                ) : null}
              </div>
              <div className="app-row-meta">
                {pricingVerified
                  ? <StatusBadge tone="success">Book verified</StatusBadge>
                  : <StatusBadge tone="warning">{commercial.state === "UNVERIFIED" ? "Unverified" : "Action needed"}</StatusBadge>}
              </div>
            </article>

            <article className="app-row">
              <div>
                <h3>Team access</h3>
                <p>
                  {teamReady
                    ? String(activeMembers.length) +
                      " active team member" +
                      (activeMembers.length === 1 ? "" : "s")
                    : "Add an active owner, dispatcher or crew member."}
                </p>
              </div>
              <div className="app-row-meta">{setupState(teamReady)}</div>
            </article>

            <article className="app-row">
              <div>
                <h3>Subscription</h3>
                <p>
                  {billingReady
                    ? "Subscription information is available."
                    : "Subscription information is not available yet."}
                </p>
              </div>
              <div className="app-row-meta">{setupState(billingReady)}</div>
            </article>
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            title="Connections"
            description="External providers are configured separately from core workspace setup."
          />
          <EmptyState
            title="Review integrations in Settings"
            description="Connection health is not inferred from local UI state. A configured key, workflow draft or simulated preview does not prove model inference or external delivery."
            action={
              <Link className="app-button-secondary" href={workspaceBase + "/settings"}>
                Open provider settings
              </Link>
            }
          />
          <div className="app-row-list">
            <article className="app-row">
              <div>
                <h3>AI &amp; Automation</h3>
                <p>{(workflowRuleVersions ?? []).filter(item => item.state === "PUBLISHED").length} published workflow version(s). Actual event receipts and provider deliveries require separate evidence.</p>
              </div>
              <Link href={workspaceBase + "/automations"}>Review automations →</Link>
            </article>
            <article className="app-row">
              <div>
                <h3>Start with a real request</h3>
                <p>Once your catalog and branch rates are configured, record or review an authorized cleaning request before generating a quote.</p>
              </div>
              <Link href={workspaceBase + "/requests"}>Open requests →</Link>
            </article>
          </div>
        </Panel>
      </div>
    </StaffAppShell>
  );
}
