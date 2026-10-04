import type { ProviderVerificationState } from "../types";

export interface ConnectorClosureSlice {
  name: string;
  status: ProviderVerificationState | "IMPLEMENTED" | "OPERATIONS_VERIFIED";
  providerVerified: boolean;
}

export interface ConnectorClosureReportInput {
  branch: string;
  startHead: string;
  finalHead: string;
  localTestsExecuted: boolean;
  runtimeBlockers: string[];
  slices: ConnectorClosureSlice[];
}

export interface ConnectorClosureReport {
  branch: string;
  startHead: string;
  finalHead: string;
  localTestsExecuted: boolean;
  runtimeBlockers: string[];
  totalSlices: number;
  providerVerifiedClaims: number;
  readyForControllerReview: boolean;
  overallProviderStatus: ProviderVerificationState;
  integrationNotes: string[];
}

export function buildConnectorClosureReport(input: ConnectorClosureReportInput): ConnectorClosureReport {
  const providerVerifiedClaims = input.slices.filter((slice) => slice.providerVerified).length;
  const hasContractCoverage = input.slices.some((slice) => slice.status === "CONTRACT_TESTED" || slice.status === "OPERATIONS_VERIFIED");

  return {
    branch: input.branch,
    startHead: input.startHead,
    finalHead: input.finalHead,
    localTestsExecuted: input.localTestsExecuted,
    runtimeBlockers: [...input.runtimeBlockers],
    totalSlices: input.slices.length,
    providerVerifiedClaims,
    readyForControllerReview: hasContractCoverage && providerVerifiedClaims === 0,
    overallProviderStatus: providerVerifiedClaims > 0 ? "PROVIDER_VERIFIED" : "CONFIGURATION_BLOCKED",
    integrationNotes: [
      "Connector code is staged for controller review; no direct business table/core mutation is authorized here.",
      "Fixture or injected-transport tests support CONTRACT_TESTED only.",
      "Live provider verification remains blocked until controlled credentials, callbacks, and receipts exist.",
      ...input.runtimeBlockers.map((blocker) => `Runtime blocker: ${blocker}.`),
    ],
  };
}
