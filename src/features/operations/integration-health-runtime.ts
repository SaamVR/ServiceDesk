import {
  PROVIDER_REQUIREMENTS,
  buildV1ProviderReadinessRegistry,
  type ConfigurationState,
  type EvidenceState,
  type ProviderMode,
  type V1Provider,
} from "@/server/integrations/readiness/provider-readiness";

export type OperationalIntegrationProvider = V1Provider | "EMAIL_INBOUND" | "VOICE_INBOUND";

export interface OperationalIntegrationHealth {
  provider: OperationalIntegrationProvider;
  label: string;
  mode: ProviderMode;
  configurationState: ConfigurationState;
  verificationState: EvidenceState | "CONFIGURATION_BLOCKED";
  missingConfiguration: string[];
  canRunControlledProof: boolean;
  source: "SERVER_CONFIGURATION_PRESENCE" | "INTERNAL_SANDBOX";
  message: string;
}

type RuntimeEnvironment = Record<string, string | undefined>;

const labels: Record<V1Provider, string> = {
  WHATSAPP: "WhatsApp",
  GOOGLE_CALENDAR: "Google Calendar",
  PAYMENT: "Payments",
  EMAIL: "Email",
  WEBHOOK_N8N: "Webhooks / n8n",
  AI: "AI assistant",
};

function present(env: RuntimeEnvironment, ...keys: string[]): boolean {
  return keys.some((key) => typeof env[key] === "string" && env[key]!.trim().length > 0);
}

function truthy(env: RuntimeEnvironment, ...keys: string[]): boolean {
  return keys.some((key) => ["1", "true", "yes", "ready"].includes((env[key] ?? "").trim().toLowerCase()));
}

function inboundReadiness(
  provider: "EMAIL_INBOUND" | "VOICE_INBOUND",
  env: RuntimeEnvironment,
): OperationalIntegrationHealth {
  const isEmail = provider === "EMAIL_INBOUND";
  const requirements = [
    {
      key: "DATABASE_CONNECTION",
      present: present(env, "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
        && present(env, "SUPABASE_SERVICE_ROLE_KEY"),
    },
    {
      key: "WEBHOOK_SIGNING_SECRET",
      present: present(
        env,
        isEmail ? "SERVICEDESK_EMAIL_WEBHOOK_SECRET" : "SERVICEDESK_VOICE_WEBHOOK_SECRET",
      ),
    },
    {
      key: "PROVIDER_ACCOUNT_WORKSPACE_MAP",
      present: present(
        env,
        isEmail ? "SERVICEDESK_EMAIL_ACCOUNT_WORKSPACE_MAP" : "SERVICEDESK_VOICE_ACCOUNT_WORKSPACE_MAP",
      ),
    },
  ];
  const missingConfiguration = requirements.filter((item) => !item.present).map((item) => item.key);
  const configuredCount = requirements.length - missingConfiguration.length;
  const configurationState: ConfigurationState = configuredCount === 0
    ? "NOT_CONFIGURED"
    : missingConfiguration.length > 0
      ? "PARTIAL"
      : "CONFIGURED";

  return {
    provider,
    label: isEmail ? "Email inbound" : "Voice inbound",
    mode: "LIVE",
    configurationState,
    verificationState: "IMPLEMENTED",
    missingConfiguration,
    canRunControlledProof: configurationState === "CONFIGURED",
    source: "SERVER_CONFIGURATION_PRESENCE",
    message: configurationState === "CONFIGURED"
      ? "Signed inbound route configuration is present. Controlled provider proof is still required before provider verification."
      : configurationState === "PARTIAL"
        ? `Inbound route configuration is partial; ${missingConfiguration.length} requirement${missingConfiguration.length === 1 ? "" : "s"} remain.`
        : "Inbound route is implemented but no server-side webhook routing configuration is present.",
  };
}

function configuredRequirements(provider: V1Provider, env: RuntimeEnvironment): string[] {
  if (provider === "PAYMENT") return [...PROVIDER_REQUIREMENTS.PAYMENT];

  const configured = new Set<string>();

  if (provider === "WHATSAPP") {
    if (present(env, "WHATSAPP_META_APP_ID", "META_APP_ID")) configured.add("META_APP_ID");
    if (present(env, "WHATSAPP_BUSINESS_ACCOUNT_ID", "META_BUSINESS_ACCOUNT_ID")) configured.add("META_BUSINESS_ACCOUNT_ID");
    if (present(env, "WHATSAPP_PHONE_NUMBER_ID", "META_PHONE_NUMBER_ID")) configured.add("META_PHONE_NUMBER_ID");
    if (present(env, "WHATSAPP_APP_SECRET", "META_APP_SECRET")) configured.add("APP_SECRET_SIGNATURE_VALIDATION");
    if (present(env, "WHATSAPP_ACCESS_TOKEN", "META_ACCESS_TOKEN")) configured.add("ACCESS_TOKEN");
    if (present(env, "WHATSAPP_CONTROLLED_RECIPIENT")) configured.add("CONTROLLED_SENDER_RECIPIENT");
    if (present(env, "WHATSAPP_CALLBACK_URL")) configured.add("CALLBACK_URL");
    if (present(env, "WHATSAPP_VERIFY_TOKEN")) configured.add("VERIFY_TOKEN");
    if (configured.size > 0) configured.add("DURABLE_RECEIPT_CORE_HANDOFF");
  }

  if (provider === "GOOGLE_CALENDAR") {
    if (
      present(env, "GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CLIENT_ID")
      && present(env, "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET")
    ) configured.add("OAUTH_CLIENT");
    if (present(env, "GOOGLE_CALENDAR_REDIRECT_URI", "GOOGLE_REDIRECT_URI")) configured.add("REDIRECT_URI");
    if (present(env, "GOOGLE_CALENDAR_REFRESH_TOKEN")) configured.add("REFRESH_TOKEN_TEST_ACCOUNT");
    if (present(env, "GOOGLE_CALENDAR_ID", "GOOGLE_CALENDAR_TEST_ID")) configured.add("TEST_CALENDAR");
    if (present(env, "GOOGLE_CALENDAR_SCOPES")) configured.add("FREEBUSY_EVENTS_SCOPES");
    if (truthy(env, "GOOGLE_CALENDAR_SYNC_READY")) configured.add("FRESH_SYNC_STATE");
  }

  if (provider === "EMAIL") {
    if (present(env, "EMAIL_PROVIDER_ACCOUNT", "EMAIL_PROVIDER_ENDPOINT")) configured.add("EMAIL_PROVIDER_ACCOUNT");
    if (present(env, "EMAIL_API_KEY", "EMAIL_API_KEY_REFERENCE")) configured.add("EMAIL_API_KEY_REFERENCE");
    if (present(env, "EMAIL_VERIFIED_DOMAIN", "EMAIL_SENDER_ADDRESS")) configured.add("VERIFIED_SENDER_DOMAIN");
    if (present(env, "EMAIL_CALLBACK_SIGNING_SECRET", "EMAIL_CALLBACK_AUTH")) configured.add("CALLBACK_SIGNING_AUTH");
    if (present(env, "EMAIL_CONTROLLED_RECIPIENT")) configured.add("CONTROLLED_RECIPIENT");
  }

  if (provider === "WEBHOOK_N8N") {
    if (present(env, "N8N_WEBHOOK_URL", "WEBHOOK_ENDPOINT_URL")) configured.add("AUTHORITATIVE_ENDPOINT");
    if (present(env, "N8N_SIGNING_SECRET", "WEBHOOK_SIGNING_SECRET")) configured.add("SIGNING_SECRET_REFERENCE");
    if (present(env, "N8N_ALLOWED_HOST", "WEBHOOK_ALLOWED_HOST")) configured.add("ALLOWED_HOST");
    if (present(env, "N8N_WORKFLOW_ID")) configured.add("N8N_WORKFLOW_ID");
    if (present(env, "N8N_COMPLETION_CALLBACK_URL")) configured.add("COMPLETION_CALLBACK_MAPPING");
  }

  if (provider === "AI") {
    const providerConfigured = present(env, "OPENAI_API_KEY", "AI_API_KEY");
    if (providerConfigured) {
      configured.add("AI_PROVIDER_CONFIGURATION");
      configured.add("MODEL_CONTRACT_PROOF");
      configured.add("NO_BUSINESS_AUTHORITY_BOUNDARY");
    }
    if (present(env, "AI_MODEL_HEALTH_ENDPOINT") || truthy(env, "AI_MODEL_HEALTH_READY")) configured.add("MODEL_HEALTH_CHECK");
  }

  return [...configured];
}

function messageFor(input: {
  provider: V1Provider;
  mode: ProviderMode;
  configurationState: ConfigurationState;
  verificationState: EvidenceState | "CONFIGURATION_BLOCKED";
  missing: string[];
}): string {
  if (input.provider === "PAYMENT") {
    return "Internal Stripe-style sandbox checkout and signed webhook/Core application are available. No live Stripe account or real-money charging is enabled.";
  }
  if (input.configurationState === "CONFIGURED") {
    return input.verificationState === "PROVIDER_VERIFIED"
      ? "Server configuration and controlled provider proof are present."
      : "Server configuration is present. Controlled provider proof is still required before this can be called provider-verified.";
  }
  if (input.configurationState === "PARTIAL") {
    return `Server configuration is partial; ${input.missing.length} readiness requirement${input.missing.length === 1 ? "" : "s"} remain.`;
  }
  return "No complete server-side configuration is registered for this provider in the current runtime.";
}

export function buildOperationalIntegrationHealth(
  env: RuntimeEnvironment = process.env,
): OperationalIntegrationHealth[] {
  const reports = buildV1ProviderReadinessRegistry(
    (["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK_N8N", "AI"] as V1Provider[]).map((provider) => ({
      provider,
      mode: provider === "PAYMENT" ? "SANDBOX" as const : "LIVE" as const,
      implementationState: provider === "PAYMENT" ? "CONTRACT_TESTED" as const : "IMPLEMENTED" as const,
      configuredRequirements: configuredRequirements(provider, env),
    })),
  );

  const providerHealth: OperationalIntegrationHealth[] = reports.map((report) => ({
    provider: report.provider,
    label: labels[report.provider],
    mode: report.mode,
    configurationState: report.configurationState,
    verificationState: report.verificationState,
    missingConfiguration: report.missingConfiguration,
    canRunControlledProof: report.canRunControlledProof,
    source: report.provider === "PAYMENT" ? "INTERNAL_SANDBOX" : "SERVER_CONFIGURATION_PRESENCE",
    message: messageFor({
      provider: report.provider,
      mode: report.mode,
      configurationState: report.configurationState,
      verificationState: report.verificationState,
      missing: report.missingConfiguration,
    }),
  }));

  return [
    ...providerHealth,
    inboundReadiness("EMAIL_INBOUND", env),
    inboundReadiness("VOICE_INBOUND", env),
  ];
}
