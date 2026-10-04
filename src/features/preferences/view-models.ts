import type { ConversationDTO, IntegrationStatusDTO } from "@/contracts";

type PreferenceSource = "FIXTURE_UI_ONLY";
type PreferenceChannel = ConversationDTO["channel"];

interface BuildCommunicationPreferenceViewInput {
  conversation: ConversationDTO;
  integrations: IntegrationStatusDTO[];
}

const providerByChannel: Record<PreferenceChannel, IntegrationStatusDTO["provider"]> = {
  WEB: "WEBHOOK",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
};

const optionLabels: Record<PreferenceChannel, string> = {
  WEB: "Web portal updates",
  WHATSAPP: "WhatsApp messages",
  EMAIL: "Email notifications",
};

function humanize(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}

function getIntegration(channel: PreferenceChannel, integrations: IntegrationStatusDTO[]) {
  return integrations.find((integration) => integration.provider === providerByChannel[channel]);
}

function describeAvailability(channel: PreferenceChannel, integrations: IntegrationStatusDTO[]) {
  const integration = getIntegration(channel, integrations);

  if (!integration) {
    return {
      available: false,
      state: "missing" as const,
      reason: `${optionLabels[channel]} provider is not configured in this fixture.`,
    };
  }

  if (integration.status !== "CONNECTED" || integration.mode === "FIXTURE") {
    return {
      available: false,
      state: integration.status.toLowerCase(),
      reason: `${optionLabels[channel]} is ${humanize(integration.status)} in ${humanize(integration.mode ?? "unknown")} mode.`,
    };
  }

  return {
    available: true,
    state: "available" as const,
    reason: `${optionLabels[channel]} is connected for real provider use.`,
  };
}

export function buildCommunicationPreferenceView({ conversation, integrations }: BuildCommunicationPreferenceViewInput) {
  const channels: PreferenceChannel[] = ["WHATSAPP", "EMAIL", "WEB"];

  return {
    source: "FIXTURE_UI_ONLY" as PreferenceSource,
    currentChannel: conversation.channel,
    quietHoursLabel: "Quiet hours: 20:00–08:00 fixture",
    consentLabel: conversation.handoverActive ? "Human handover active; AI may draft but not auto-send." : "AI draft mode allowed with staff review.",
    options: channels.map((channel) => ({
      channel,
      label: optionLabels[channel],
      selected: conversation.channel === channel,
      ...describeAvailability(channel, integrations),
    })),
    boundaryNotice: "Communication preferences need a shared DTO before these settings can become production business truth.",
  };
}
