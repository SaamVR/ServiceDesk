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
import { OnboardingOperationalEvidencePanel } from "./OnboardingOperationalEvidencePanel";
import { availableFirstRunUsdBranches } from "@/features/operations/owner-pricing-readiness";
import { summarizeAutomationActivation } from "@/features/operations/owner-automation-activation";
import { buildStaffModuleHref } from "@/features/operations/staff-modules";

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

  if (!result.ok && result.kind === "selection") {
    return (
      <main className="site-shell">
        <PageHeader
          eyebrow="Choose your cleaning business"
          title="Which workspace are you setting up?"
          description="You have more than one active owner workspace. Choose the business you want to configure. Your role and saved data are checked again before any changes."
        />
        <Panel>
          <nav aria-label="Your authorized owner workspaces" className="app-row-list">
            {result.workspaces.map(ownerWorkspace => (
              <Link
                key={ownerWorkspace.id}
                href={"/onboarding?workspace=" + encodeURIComponent(ownerWorkspace.slug)}
                className="app-row"
                style={{ textDecoration: "none" }}
              >
                <span>
                  <strong>{ownerWorkspace.name}</strong>
                  <span style={{ display: "block", fontSize: ".85rem" }}>
                    {ownerWorkspace.slug} · Owner access
                  </span>
                </span>
                <strong aria-hidden="true">↗</strong>
              </Link>
            ))}
          </nav>
        </Panel>
        <p style={{ fontSize: ".85rem" }}>
          Only businesses returned by your authenticated owner membership are listed.
          No workspace was selected on your behalf.
        </p>
      </main>
    );
  }

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
  const canEnterFirstRunRates =
    availableFirstRunUsdBranches(branchScope, ownerPricingBookProof).length > 0;
  const settingsHref = workspaceBase + "/settings";
  const realPricingHref = settingsHref +
    (canEnterFirstRunRates ? "#owner-first-run-pricing" : "");
  const needsPricing = !servicesReady || !pricingVerified;
  const automationActivation = summarizeAutomationActivation(result.value);

  return (
    <StaffAppShell workspace={workspace.slug}>
      <PageHeader
        eyebrow="Workspace setup"
        title="Finish setting up ServiceDesk"
        description="Check your saved services and branch prices first. These five setup signals are not a live-provider or customer-workflow certification."
        actions={
          <Link className="app-button-primary"
            href={needsPricing ? realPricingHref : workspaceBase + "/overview"}>
            {needsPricing
              ? canEnterFirstRunRates ? "Enter actual cleaning rates" : "Review business pricing"
              : "Open workspace"}
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
                {!servicesReady ? <Link href={realPricingHref}>Configure actual services →</Link> : null}
              </div>
              <div className="app-row-meta">{setupState(servicesReady)}</div>
            </article>

            <article className="app-row">
              <div>
                <h3>Branch price books</h3>
                <p>{commercial.detail}</p>
                {!pricingVerified ? (
                  <Link href={realPricingHref}>Review branch pricing in Settings →</Link>
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
                <h3>Workspace plan</h3>
                <p>{billingReady
                  ? `Plan status: ${platformBilling?.subscription.status}. This is account access status, not proof of a real customer payment.`
                  : platformBilling?.subscription.status
                    ? `Plan status: ${platformBilling.subscription.status}. Review billing before relying on your workspace plan.`
                    : "Plan status has not been verified. Review account billing."}</p>
                {!billingReady ? <Link href={workspaceBase + "/billing"}>Review workspace plan →</Link> : null}
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

      <Panel>
        <SectionHeader
          title="Turn on a real internal cleaning automation"
          description="A saved service, authorized branch rate card, published QUOTE_ACCEPTED rule and real accepted customer quote are required for a meaningful end-to-end review. A completed internal attention receipt is separate evidence."
        />
        <div className="app-row-list">
          {automationActivation.steps.map(step => (
            <article className="app-row" key={step.id}>
              <div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
                <Link href={buildStaffModuleHref(workspace.slug, step.module)}>
                  {step.module === "settings" ? "Review Settings"
                    : step.module === "requests" ? "Review customer requests"
                    : "Open Automation Studio"} →
                </Link>
              </div>
              <div className="app-row-meta">
                {step.status === "READY" ? (
                  <StatusBadge tone="success">Saved evidence</StatusBadge>
                ) : step.status === "UNVERIFIED" ? (
                  <StatusBadge tone="warning">Unverified</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Action needed</StatusBadge>
                )}
              </div>
            </article>
          ))}
        </div>
        <p style={{ fontSize: ".78rem", margin: "15px 0 0", lineHeight: 1.6 }}>
          {automationActivation.readyCount} of {automationActivation.total} saved activation signals verified.
          A configured trigger or draft rule never proves an AI model call, an external message, or a complete customer workflow.
          Only workspace owners can enable the protected internal follow-up after prerequisites pass.
        </p>
      </Panel>

      <OnboardingOperationalEvidencePanel
        workspaceSlug={workspace.slug}
        snapshot={result.value}
      />
    </StaffAppShell>
  );
}
