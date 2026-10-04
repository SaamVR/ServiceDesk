import type { ProviderVerificationState, RedactedProviderEvidence } from "../types";

export interface ProviderReadinessSnapshotInput {
  provider: RedactedProviderEvidence["provider"] | "GOOGLE_CALENDAR";
  status: ProviderVerificationState;
  missing: string[];
}

export type ProviderRecoveryAction = "RETRY" | "RECONCILE" | "OPERATOR_REVIEW" | "DEAD_LETTER";

export interface ProviderRecoverySnapshotInput {
  provider: RedactedProviderEvidence["provider"] | "GOOGLE_CALENDAR";
  action: ProviderRecoveryAction;
  count: number;
}

export interface ProviderEvidenceSnapshotInput {
  provider: RedactedProviderEvidence["provider"] | "GOOGLE_CALENDAR";
  verification: ProviderVerificationState;
  count: number;
}

export interface ProviderOperationsSnapshotInput {
  workspaceId: string;
  generatedAt: string;
  readiness: ProviderReadinessSnapshotInput[];
  recovery: ProviderRecoverySnapshotInput[];
  evidence: ProviderEvidenceSnapshotInput[];
}

export interface ProviderOperationsSnapshot {
  workspaceId: string;
  generatedAt: string;
  overallStatus: ProviderVerificationState;
  providerCount: number;
  blockedProviders: string[];
  providerVerifiedCount: number;
  contractTestedCount: number;
  recoveryQueueCount: number;
  operatorReviewCount: number;
  evidenceCounts: Record<ProviderVerificationState, number>;
  notes: string[];
}

function overallStatus(readiness: ProviderReadinessSnapshotInput[]): ProviderVerificationState {
  if (readiness.some((provider) => provider.status === "CONFIGURATION_BLOCKED" || provider.missing.length > 0)) return "CONFIGURATION_BLOCKED";
  if (readiness.length > 0 && readiness.every((provider) => provider.status === "PROVIDER_VERIFIED")) return "PROVIDER_VERIFIED";
  return "CONTRACT_TESTED";
}

function evidenceCounts(evidence: ProviderEvidenceSnapshotInput[]): Record<ProviderVerificationState, number> {
  return evidence.reduce<Record<ProviderVerificationState, number>>(
    (counts, item) => {
      counts[item.verification] += item.count;
      return counts;
    },
    { CONFIGURATION_BLOCKED: 0, CONTRACT_TESTED: 0, PROVIDER_VERIFIED: 0 },
  );
}

export function buildProviderOperationsSnapshot(input: ProviderOperationsSnapshotInput): ProviderOperationsSnapshot {
  const blockedProviders = input.readiness.filter((provider) => provider.status === "CONFIGURATION_BLOCKED" || provider.missing.length > 0).map((provider) => provider.provider);
  const providerVerifiedCount = input.readiness.filter((provider) => provider.status === "PROVIDER_VERIFIED").length;
  const contractTestedCount = input.readiness.filter((provider) => provider.status === "CONTRACT_TESTED").length;
  const recoveryQueueCount = input.recovery.reduce((total, item) => total + item.count, 0);
  const operatorReviewCount = input.recovery.filter((item) => item.action === "OPERATOR_REVIEW").reduce((total, item) => total + item.count, 0);
  const status = overallStatus(input.readiness);

  const notes: string[] = [];
  if (blockedProviders.length > 0) notes.push(`${blockedProviders.length} provider(s) still blocked by missing configuration.`);
  if (operatorReviewCount > 0) notes.push(`${operatorReviewCount} recovery item(s) require operator review.`);
  if (status === "PROVIDER_VERIFIED") notes.push("All listed providers are provider-verified.");
  if (notes.length === 0) notes.push("No provider blockers were summarized in this snapshot.");

  return {
    workspaceId: input.workspaceId,
    generatedAt: input.generatedAt,
    overallStatus: status,
    providerCount: input.readiness.length,
    blockedProviders,
    providerVerifiedCount,
    contractTestedCount,
    recoveryQueueCount,
    operatorReviewCount,
    evidenceCounts: evidenceCounts(input.evidence),
    notes,
  };
}
