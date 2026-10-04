import {
  buildProviderOperationsSnapshot,
  type ProviderEvidenceSnapshotInput,
  type ProviderReadinessSnapshotInput,
  type ProviderRecoverySnapshotInput,
} from "../integrations/operations/snapshot";

export interface ProviderStatusHandlerInput {
  actorWorkspaceId: string;
  workspaceId: string;
  generatedAt: string;
  readiness: ProviderReadinessSnapshotInput[];
  recovery: ProviderRecoverySnapshotInput[];
  evidence: ProviderEvidenceSnapshotInput[];
}

export interface ProviderStatusHandlerResult {
  statusCode: number;
  body: string;
  acknowledged: boolean;
  retryable: boolean;
}

export function handleProviderStatus(input: ProviderStatusHandlerInput): ProviderStatusHandlerResult {
  if (input.actorWorkspaceId !== input.workspaceId) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        code: "WORKSPACE_MISMATCH",
        message: "Provider status workspace does not match actor workspace.",
      }),
      acknowledged: false,
      retryable: false,
    };
  }

  const snapshot = buildProviderOperationsSnapshot({
    workspaceId: input.workspaceId,
    generatedAt: input.generatedAt,
    readiness: input.readiness,
    recovery: input.recovery,
    evidence: input.evidence,
  });

  return {
    statusCode: 200,
    body: JSON.stringify(snapshot),
    acknowledged: true,
    retryable: false,
  };
}
