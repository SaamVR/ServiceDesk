import type { IntegrationStatusDTO } from "@/contracts";

type OnboardingState = "IMPLEMENTED" | "CONFIGURATION_BLOCKED";
export type OnboardingStepState = "COMPLETE" | "NEEDS_INPUT" | "CONFIGURATION_BLOCKED";

const providerLabels: Record<IntegrationStatusDTO["provider"], string> = {
  WHATSAPP: "WhatsApp",
  GOOGLE_CALENDAR: "Google Calendar",
  PAYMENT: "Payments",
  EMAIL: "Email",
  WEBHOOK: "Webhooks",
  AI: "AI assistant",
};

export interface OnboardingReadinessItem {
  provider: IntegrationStatusDTO["provider"];
  label: string;
  stateLabel: string;
  canClaimLive: boolean;
  detail: string;
}

export interface OnboardingReadinessView {
  overallState: OnboardingState;
  releaseNote: string;
  items: OnboardingReadinessItem[];
}

export interface OnboardingSetupStep {
  key: "business" | "services" | "team" | "policies" | "integrations" | "readiness";
  label: string;
  state: OnboardingStepState;
  detail: string;
}

export interface OnboardingSetupView {
  readyToLaunch: boolean;
  launchLabel: string;
  steps: OnboardingSetupStep[];
}

export function buildOnboardingReadinessView(integrations: IntegrationStatusDTO[]): OnboardingReadinessView {
  const items = integrations.map((integration) => {
    const canClaimLive = integration.status === "CONNECTED" && integration.mode === "LIVE";
    const mode = integration.mode ? ` ${integration.mode.toLowerCase()}` : "";
    const status = integration.status.toLowerCase().replaceAll("_", " ");

    return {
      provider: integration.provider,
      label: providerLabels[integration.provider],
      stateLabel: `${status}${mode}`.replace(/^./, (match) => match.toUpperCase()),
      canClaimLive,
      detail: integration.message ?? "No setup message recorded.",
    };
  });

  const allLive = items.length > 0 && items.every((item) => item.canClaimLive);

  return {
    overallState: allLive ? "IMPLEMENTED" : "CONFIGURATION_BLOCKED",
    releaseNote: allLive
      ? "All listed integrations are connected in live mode. Provider receipts still need to be attached to the release packet."
      : "Provider receipts are still required before the UI may claim live WhatsApp, Calendar or payment operation.",
    items,
  };
}

export function buildOnboardingSetupView(integrations: readonly IntegrationStatusDTO[]): OnboardingSetupView {
  const readiness = buildOnboardingReadinessView([...integrations]);
  const integrationsLive = readiness.overallState === "IMPLEMENTED";

  const steps: OnboardingSetupStep[] = [
    {
      key: "business",
      label: "Business profile",
      state: "COMPLETE",
      detail: "Showcase business identity is present; production values must come from owner settings.",
    },
    {
      key: "services",
      label: "Services, areas and rates",
      state: "NEEDS_INPUT",
      detail: "Move-out fixture exists; real service catalog and operating areas need owner configuration.",
    },
    {
      key: "team",
      label: "Team and crew",
      state: "NEEDS_INPUT",
      detail: "Fixture dispatcher and crew are visible; invite acceptance remains owner-controlled.",
    },
    {
      key: "policies",
      label: "Policies",
      state: "NEEDS_INPUT",
      detail: "Quote, hold, review and cancellation policy copy is visible but not authoritative yet.",
    },
    {
      key: "integrations",
      label: "Integrations",
      state: integrationsLive ? "COMPLETE" : "CONFIGURATION_BLOCKED",
      detail: integrationsLive
        ? "All integrations are live in the supplied snapshot."
        : "At least one required provider is fixture, sandbox, degraded, blocked or not configured.",
    },
    {
      key: "readiness",
      label: "Launch readiness",
      state: integrationsLive ? "COMPLETE" : "CONFIGURATION_BLOCKED",
      detail: integrationsLive
        ? "Launch may proceed only after provider receipts are attached to the release packet."
        : "Launch remains blocked until provider configuration and evidence are verified.",
    },
  ];

  const readyToLaunch = steps.every((step) => step.state === "COMPLETE");

  return {
    readyToLaunch,
    launchLabel: readyToLaunch
      ? "Ready for launch review"
      : integrationsLive
        ? "Launch blocked by missing owner setup"
        : "Launch blocked by provider configuration",
    steps,
  };
}
