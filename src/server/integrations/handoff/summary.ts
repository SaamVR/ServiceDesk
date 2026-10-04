import type { ProviderVerificationState, RedactedProviderEvidence } from "../types";

export type ConnectorCompletionLabel = "IMPLEMENTED" | "CONTRACT_TESTED" | "PROVIDER_VERIFIED" | "CONFIGURATION_BLOCKED";

export interface ConnectorSliceStatus {
  name: string;
  status: ConnectorCompletionLabel;
}

export interface ConnectorProviderEvidenceStatus {
  provider: RedactedProviderEvidence["provider"];
  verification: ProviderVerificationState;
}

export interface ConnectorTestExecution {
  focusedTestsRun: number;
  focusedTestsPassed: number;
  blockedReason?: string;
}

export interface ConnectorHandoffSummaryInput {
  branch: string;
  head: string;
  generatedAt: string;
  slices: ConnectorSliceStatus[];
  providerEvidence: ConnectorProviderEvidenceStatus[];
  testExecution: ConnectorTestExecution;
  integrationOnlyFiles: string[];
}

export interface ConnectorHandoffSummary {
  branch: string;
  head: string;
  generatedAt: string;
  completionLabel: ConnectorCompletionLabel;
  sliceCount: number;
  implementedSlices: string[];
  providerVerified: boolean;
  configurationBlockedProviders: string[];
  contractTestedProviders: string[];
  tests: {
    run: number;
    passed: number;
    blocked: boolean;
    blockedReason?: string;
  };
  integrationOnlyFiles: string[];
  notes: string[];
}

function completionLabel(input: ConnectorHandoffSummaryInput): ConnectorCompletionLabel {
  const allProviderVerified =
    input.providerEvidence.length > 0 &&
    input.providerEvidence.every((item) => item.verification === "PROVIDER_VERIFIED");

  if (allProviderVerified && input.testExecution.focusedTestsRun > 0 && input.testExecution.focusedTestsRun === input.testExecution.focusedTestsPassed) {
    return "PROVIDER_VERIFIED";
  }

  if (input.testExecution.focusedTestsRun > 0 && input.testExecution.focusedTestsRun === input.testExecution.focusedTestsPassed) {
    return "CONTRACT_TESTED";
  }

  return "IMPLEMENTED";
}

export function buildConnectorHandoffSummary(input: ConnectorHandoffSummaryInput): ConnectorHandoffSummary {
  const configurationBlockedProviders = input.providerEvidence
    .filter((item) => item.verification === "CONFIGURATION_BLOCKED")
    .map((item) => item.provider);

  const contractTestedProviders = input.providerEvidence
    .filter((item) => item.verification === "CONTRACT_TESTED")
    .map((item) => item.provider);

  const providerVerified =
    input.providerEvidence.length > 0 &&
    input.providerEvidence.every((item) => item.verification === "PROVIDER_VERIFIED");

  const notes: string[] = [];
  if (input.testExecution.blockedReason) notes.push(`Focused test execution blocked: ${input.testExecution.blockedReason}`);
  if (configurationBlockedProviders.length > 0) {
    notes.push(`${configurationBlockedProviders.length} provider(s) remain configuration-blocked; do not claim PROVIDER_VERIFIED.`);
  }
  if (input.integrationOnlyFiles.length > 0) {
    notes.push("Integrator-only files are listed for controller review and must not be changed further from the connector lane.");
  }
  if (notes.length === 0) notes.push("Connector handoff has no reported execution or provider blockers.");

  return {
    branch: input.branch,
    head: input.head,
    generatedAt: input.generatedAt,
    completionLabel: completionLabel(input),
    sliceCount: input.slices.length,
    implementedSlices: input.slices.filter((slice) => slice.status === "IMPLEMENTED").map((slice) => slice.name),
    providerVerified,
    configurationBlockedProviders,
    contractTestedProviders,
    tests: {
      run: input.testExecution.focusedTestsRun,
      passed: input.testExecution.focusedTestsPassed,
      blocked: Boolean(input.testExecution.blockedReason),
      blockedReason: input.testExecution.blockedReason,
    },
    integrationOnlyFiles: [...input.integrationOnlyFiles],
    notes,
  };
}
