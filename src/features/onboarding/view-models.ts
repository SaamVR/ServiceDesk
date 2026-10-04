import type { IntegrationStatusDTO } from "@/contracts";

type OnboardingState = "IMPLEMENTED" | "CONFIGURATION_BLOCKED";

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
