import type { IntegrationStatusDTO } from "@/contracts";

export interface ServiceSettingFixture {
  code: string;
  label: string;
  enabled: boolean;
  rateVersion: string;
}

export interface TeamInviteFixture {
  id: string;
  role: "OWNER" | "DISPATCHER" | "CREW";
  state: "PENDING" | "ACCEPTED" | "REVOKED";
  label: string;
}

export interface OwnerSettingsView {
  releaseLabel: "IMPLEMENTED" | "CONFIGURATION_BLOCKED";
  dataSource: "FIXTURE_UI_ONLY";
  exposesSecrets: false;
  services: Array<ServiceSettingFixture & { stateLabel: string }>;
  team: Array<TeamInviteFixture & { stateLabel: string }>;
  integrationHealth: Array<{
    provider: IntegrationStatusDTO["provider"];
    ready: boolean;
    stateLabel: string;
    message: string;
  }>;
}

export function buildOwnerSettingsView({
  services,
  invites,
  integrations,
}: {
  services: readonly ServiceSettingFixture[];
  invites: readonly TeamInviteFixture[];
  integrations: readonly IntegrationStatusDTO[];
}): OwnerSettingsView {
  const integrationHealth = integrations.map((integration) => {
    const ready =
      integration.status === "CONNECTED" &&
      integration.mode === "LIVE";

    return {
      provider: integration.provider,
      ready,
      stateLabel: `${integration.status.replaceAll("_", " ")}${integration.mode ? ` · ${integration.mode}` : ""}`,
      message: integration.message ?? "No status message available.",
    };
  });

  return {
    releaseLabel: integrationHealth.every((item) => item.ready)
      ? "IMPLEMENTED"
      : "CONFIGURATION_BLOCKED",
    dataSource: "FIXTURE_UI_ONLY",
    exposesSecrets: false,
    services: services.map((service) => ({
      ...service,
      stateLabel: service.enabled ? "Enabled" : "Draft / disabled",
    })),
    team: invites.map((invite) => ({
      ...invite,
      stateLabel: invite.state.replaceAll("_", " "),
    })),
    integrationHealth,
  };
}
