import type { OutboxJob, ProviderMode, ProviderSendResult, RedactedProviderEvidence } from "../types";

export interface WhatsAppAcceptanceReceipt {
  receiptKey: string;
  workspaceId: string;
  outboxJobId: string;
  outboxIdempotencyKey: string;
  providerMessageId: string;
  acceptedAt: string;
  recordedAt: string;
  mode: ProviderMode;
  evidence: RedactedProviderEvidence;
  deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY";
  deliveryProof: false;
  readProof: false;
}

export type WhatsAppAcceptanceReceiptMergeResult =
  | { status: "RECORDED"; receipt: WhatsAppAcceptanceReceipt }
  | { status: "DUPLICATE"; receipt: WhatsAppAcceptanceReceipt }
  | { status: "CONFLICT"; receipt: WhatsAppAcceptanceReceipt; conflict: WhatsAppAcceptanceReceipt };

export function whatsAppAcceptanceReceiptKey(job: Pick<OutboxJob, "workspaceId" | "idempotencyKey">): string {
  return `${job.workspaceId}:${job.idempotencyKey}`;
}

export function buildWhatsAppAcceptanceReceipt(input: {
  job: OutboxJob;
  result: ProviderSendResult;
  recordedAt: string;
}): WhatsAppAcceptanceReceipt {
  return {
    receiptKey: whatsAppAcceptanceReceiptKey(input.job),
    workspaceId: input.job.workspaceId,
    outboxJobId: input.job.id,
    outboxIdempotencyKey: input.job.idempotencyKey,
    providerMessageId: input.result.providerMessageId,
    acceptedAt: input.result.acceptedAt,
    recordedAt: input.recordedAt,
    mode: input.result.mode,
    evidence: input.result.evidence,
    deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY",
    deliveryProof: false,
    readProof: false,
  };
}

export function mergeWhatsAppAcceptanceReceipt(
  existing: WhatsAppAcceptanceReceipt | null,
  candidate: WhatsAppAcceptanceReceipt,
): WhatsAppAcceptanceReceiptMergeResult {
  if (!existing) return { status: "RECORDED", receipt: candidate };
  if (existing.receiptKey === candidate.receiptKey) return { status: "DUPLICATE", receipt: existing };
  return { status: "CONFLICT", receipt: existing, conflict: candidate };
}
