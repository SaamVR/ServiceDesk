import { blockedConfiguration, type ProviderConfigurationCheck } from "./types";

export interface OperationalProviderReadinessReport {
  email: ProviderConfigurationCheck;
  webhookN8n: ProviderConfigurationCheck;
  liveProviderGate: "NOT_READY" | "EMAIL_PROVIDER_ACCESS_REQUIRED" | "N8N_WEBHOOK_ENDPOINT_REQUIRED" | "MULTIPLE_REQUIRED";
}

export function buildOperationalProviderReadinessReport(now: string): OperationalProviderReadinessReport {
  const email = blockedConfiguration("EMAIL", [
    "transactional email provider account/API key",
    "verified sender/domain",
    "delivery callback signing secret",
    "callback endpoint routing to Email callback bridge",
  ], now);

  const webhookN8n = blockedConfiguration("WEBHOOK", [
    "authoritative webhook endpoint registry",
    "per-endpoint signing secret references",
    "allowed host allowlist",
    "n8n workflow endpoint and completion callback mapping",
    "recovery queue/attention command consumer",
  ], now);

  return {
    email,
    webhookN8n,
    liveProviderGate: "MULTIPLE_REQUIRED",
  };
}
