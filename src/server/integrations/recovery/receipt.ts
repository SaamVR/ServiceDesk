import type { ProviderVerificationState, RedactedProviderEvidence } from "../types";
import type { ProviderRecoveryOperation } from "./policy";
import type { ProviderRecoveryAttemptDisposition, ProviderRecoveryAttemptOutcome } from "./executor";

export interface ProviderRecoveryReceiptInput {
  workspaceId: string;
  provider: RedactedProviderEvidence["provider"];
  operation: ProviderRecoveryOperation;
  disposition: ProviderRecoveryAttemptDisposition;
  outcome: ProviderRecoveryAttemptOutcome;
  idempotencyKey: string;
  attemptNumber: number;
  attemptedAt: string;
  nextAttemptAt?: string;
  verification: ProviderVerificationState;
  controlledReceiptRef?: string;
}

export interface ProviderRecoveryReceipt {
  workspaceId: string;
  provider: RedactedProviderEvidence["provider"];
  operation: ProviderRecoveryOperation;
  disposition: ProviderRecoveryAttemptDisposition;
  outcome: ProviderRecoveryAttemptOutcome;
  attemptNumber: number;
  attemptedAt: string;
  nextAttemptAt?: string;
  terminal: boolean;
  operatorActionRequired: boolean;
  mutatesBusinessTruth: false;
  verification: ProviderVerificationState;
  controlledReceiptRef?: string;
  notes: string[];
}

export interface ProviderRecoveryReceiptSummary {
  total: number;
  terminal: number;
  operatorActionRequired: number;
  byProvider: Partial<Record<RedactedProviderEvidence["provider"], number>>;
  byVerification: Partial<Record<ProviderVerificationState, number>>;
}

function isTerminal(disposition: ProviderRecoveryAttemptDisposition): boolean {
  return disposition === "COMPLETE" ||
    disposition === "OPERATOR_REVIEW" ||
    disposition === "DEAD_LETTER" ||
    disposition === "BLOCKED_CONFIGURATION";
}

function requiresOperator(disposition: ProviderRecoveryAttemptDisposition): boolean {
  return disposition === "OPERATOR_REVIEW" ||
    disposition === "DEAD_LETTER" ||
    disposition === "BLOCKED_CONFIGURATION";
}

export function buildProviderRecoveryReceipt(input: ProviderRecoveryReceiptInput): ProviderRecoveryReceipt {
  const notes = [
    `Recovery attempt ${input.attemptNumber} completed with disposition ${input.disposition}.`,
    "Recovery receipts are operational evidence only and do not mutate booking, payment, or customer business truth.",
  ];

  if (input.verification !== "PROVIDER_VERIFIED") {
    notes.push("Receipt preserves the existing provider verification level; fixture or configured sandbox evidence is not upgraded.");
  }

  if (input.controlledReceiptRef) {
    notes.push("A controlled redacted provider receipt reference was recorded separately.");
  }

  return {
    workspaceId: input.workspaceId,
    provider: input.provider,
    operation: input.operation,
    disposition: input.disposition,
    outcome: input.outcome,
    attemptNumber: input.attemptNumber,
    attemptedAt: input.attemptedAt,
    nextAttemptAt: input.nextAttemptAt,
    terminal: isTerminal(input.disposition),
    operatorActionRequired: requiresOperator(input.disposition),
    mutatesBusinessTruth: false,
    verification: input.verification,
    controlledReceiptRef: input.controlledReceiptRef,
    notes,
  };
}

export function summarizeProviderRecoveryReceipts(receipts: ProviderRecoveryReceipt[]): ProviderRecoveryReceiptSummary {
  return receipts.reduce<ProviderRecoveryReceiptSummary>(
    (summary, receipt) => {
      summary.total += 1;
      if (receipt.terminal) summary.terminal += 1;
      if (receipt.operatorActionRequired) summary.operatorActionRequired += 1;
      summary.byProvider[receipt.provider] = (summary.byProvider[receipt.provider] ?? 0) + 1;
      summary.byVerification[receipt.verification] = (summary.byVerification[receipt.verification] ?? 0) + 1;
      return summary;
    },
    { total: 0, terminal: 0, operatorActionRequired: 0, byProvider: {}, byVerification: {} },
  );
}
