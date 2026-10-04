import type { ProviderConfigurationCheck, ProviderVerificationState, RedactedProviderEvidence } from "../types";

export interface ProviderReadinessSummary {
  overall: ProviderVerificationState;
  providerVerifiedReady: boolean;
  checkedProviders: RedactedProviderEvidence["provider"][];
  blockedProviders: RedactedProviderEvidence["provider"][];
  missingConfiguration: string[];
  notes: string[];
}

export function summarizeProviderReadiness(checks: ProviderConfigurationCheck[]): ProviderReadinessSummary {
  const checkedProviders = checks.map((check) => check.provider);
  const blockedProviders = checks.filter((check) => check.status === "CONFIGURATION_BLOCKED").map((check) => check.provider);
  const missingConfiguration = checks.flatMap((check) => check.requiredConfiguration.map((requirement) => `${check.provider}:${requirement}`));
  const allVerified = checks.length > 0 && checks.every((check) => check.status === "PROVIDER_VERIFIED");
  const anyBlocked = blockedProviders.length > 0;

  const overall: ProviderVerificationState = anyBlocked ? "CONFIGURATION_BLOCKED" : allVerified ? "PROVIDER_VERIFIED" : "CONTRACT_TESTED";

  const notes: string[] = [];
  if (anyBlocked) {
    notes.push("At least one provider is missing required controlled configuration; do not run provider verification yet.");
  } else if (!allVerified) {
    notes.push("Providers are configured only for contract or fixture validation; controlled receipts are still required before PROVIDER_VERIFIED.");
  } else {
    notes.push("Every checked provider has controlled provider evidence. Verify artifacts before release promotion.");
  }

  return {
    overall,
    providerVerifiedReady: overall === "PROVIDER_VERIFIED",
    checkedProviders,
    blockedProviders,
    missingConfiguration,
    notes,
  };
}
