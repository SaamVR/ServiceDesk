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
                : "Onboarding unavailable"
            }
            description={result.message}
            action={
              result.kind === "authentication" ? (
                <Link
                  className="app-button-primary"
                  href={
                    "/auth/sign-in?next=" +
                    encodeURIComponent(
                      workspaceSlug
                        ? "/onboarding?workspace=" + encodeURIComponent(workspaceSlug)
                        : "/onboarding",
                    )
                  }
                >
                  Sign in
                </Link>
              ) : undefined
            }
          />
        </Panel>
      </main>
    );
  }

  const { workspace, ownerSettings, platformBilling } = result.value;
  const enabledServices =
    ownerSettings?.services.filter((service) => service.enabled) ?? [];
  const activeMembers =
    ownerSettings?.members.filter((member) => member.active) ?? [];
  const businessReady = Boolean(workspace.name && workspace.timezone);
  const servicesReady = enabledServices.length > 0;
  const teamReady = activeMembers.length > 0;
  const billingReady = Boolean(platformBilling?.subscription.status);
  const readyCount = [businessReady, servicesReady, teamReady, billingReady].filter(
    Boolean,
  ).length;
  const workspaceBase =
    "/app/" + encodeURIComponent(workspace.slug);

  return (
    <StaffAppShell workspace={workspace.slug}>
      <PageHeader
        eyebrow="Workspace setup"
        title="Finish setting up ServiceDesk"
        description="Complete the operational basics below, then configure external connections from Settings."
        actions={
          <Link className="app-button-primary" href={workspaceBase + "/overview"}>
            Open workspace
          </Link>
        }
      />

      <MetricStrip
        items={[
          {
            label: "Setup complete",
            value: String(readyCount) + "/4",
            detail: "Core workspace checks",
          },
          {
            label: "Services",
            value: enabledServices.length,
            detail: "Enabled services",
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
                      " enabled service" +
                      (enabledServices.length === 1 ? "" : "s")
                    : "Add at least one service customers can request."}
                </p>
              </div>
              <div className="app-row-meta">{setupState(servicesReady)}</div>
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
            description="Connection health is not inferred from local UI state. Open Settings to configure and review provider connections."
            action={
              <Link
                className="app-button-secondary"
                href={workspaceBase + "/settings"}
              >
                Open settings
              </Link>
            }
          />
        </Panel>
      </div>
    </StaffAppShell>
  );
}
