import type { ProviderConfigurationCheck, RedactedProviderEvidence } from "../types";

export type ConfigurableProvider = RedactedProviderEvidence["provider"];
export type ProviderConfigurationFlags = Record<string, boolean>;

const providerRequirements: Record<ConfigurableProvider, string[]> = {
  WHATSAPP: ["metaAppSecret", "webhookVerifyToken", "businessAccountId", "phoneNumberId", "approvedTemplates", "controlledRecipient"],
  GOOGLE_CALENDAR: ["oauthClient", "redirectUri", "refreshToken", "selectedCalendar", "controlledCalendar"],
  PAYMENT: ["sandboxAccount", "webhookSecret", "checkoutSuccessUrl", "checkoutCancelUrl", "controlledReceipt"],
  EMAIL: ["verifiedDomain", "senderAddress", "bounceWebhook", "controlledRecipient"],
  WEBHOOK: ["endpointUrl", "signingSecret", "controlledReceiver"],
  AI: ["modelApiKey", "approvedKnowledgeIndex", "toolAllowlist"],
};

export interface ProviderConfigurationInput {
  provider: ConfigurableProvider;
  now: string;
  configured: ProviderConfigurationFlags;
}

function missingRequirements(provider: ConfigurableProvider, configured: ProviderConfigurationFlags): string[] {
  return providerRequirements[provider].filter((requirement) => configured[requirement] !== true);
}

export function assessProviderConfiguration(input: ProviderConfigurationInput): ProviderConfigurationCheck {
  const missing = missingRequirements(input.provider, input.configured);
  const status = missing.length === 0 ? "CONTRACT_TESTED" : "CONFIGURATION_BLOCKED";

  return {
    provider: input.provider,
    mode: "SANDBOX",
    status,
    requiredConfiguration: missing,
    evidence: {
      provider: input.provider,
      mode: "SANDBOX",
      verification: status,
      capturedAt: input.now,
      notes:
        status === "CONTRACT_TESTED"
          ? ["Provider configuration checklist is complete for controlled sandbox proof; provider receipt still required before PROVIDER_VERIFIED."]
          : missing.map((requirement) => `Missing configuration: ${requirement}. Do not include credentials in evidence.`),
    },
  };
}

export function buildProviderConfigurationMatrix(
  now: string,
  configuredByProvider: Partial<Record<ConfigurableProvider, ProviderConfigurationFlags>>,
): ProviderConfigurationCheck[] {
  return (Object.keys(providerRequirements) as ConfigurableProvider[]).map((provider) =>
    assessProviderConfiguration({ provider, now, configured: configuredByProvider[provider] ?? {} }),
  );
}
