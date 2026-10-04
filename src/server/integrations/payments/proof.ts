import type { ProviderMode, ProviderVerificationState, RedactedProviderEvidence } from "../types";

export type PaymentProofArtifact = "controlledCheckoutSessionId" | "signedWebhookEventId" | "redactedTransactionRef" | "operatorAttestation";

export interface PaymentProviderProofPacketInput {
  mode: ProviderMode;
  capturedAt: string;
  providerAccountId: string;
  controlledCheckoutSessionId?: string;
  signedWebhookEventId?: string;
  redactedTransactionRef?: string;
  operatorAttestation?: string;
}

export interface PaymentProviderProofPacket {
  provider: "PAYMENT";
  providerAccountId: string;
  mode: ProviderMode;
  status: ProviderVerificationState;
  requiredArtifacts: PaymentProofArtifact[];
  missingArtifacts: PaymentProofArtifact[];
  controlledCheckoutSessionId?: string;
  signedWebhookEventId?: string;
  redactedTransactionRef?: string;
  evidence: RedactedProviderEvidence;
}

export interface PaymentProviderProofAssessment {
  status: ProviderVerificationState;
  canClaimProviderVerified: boolean;
  blockers: string[];
}

const REQUIRED_ARTIFACTS: PaymentProofArtifact[] = ["controlledCheckoutSessionId", "signedWebhookEventId", "redactedTransactionRef", "operatorAttestation"];

function missingArtifacts(input: PaymentProviderProofPacketInput): PaymentProofArtifact[] {
  return REQUIRED_ARTIFACTS.filter((artifact) => !input[artifact]);
}

function redactedReceipt(input: PaymentProviderProofPacketInput): string | undefined {
  if (!input.controlledCheckoutSessionId || !input.signedWebhookEventId) return undefined;
  return `${input.controlledCheckoutSessionId.slice(0, 8)}…/${input.signedWebhookEventId.slice(0, 8)}…`;
}

export function buildPaymentProviderProofPacket(input: PaymentProviderProofPacketInput): PaymentProviderProofPacket {
  const missing = missingArtifacts(input);
  const status: ProviderVerificationState = missing.length === 0 ? "CONTRACT_TESTED" : "CONFIGURATION_BLOCKED";
  const notes = missing.length === 0
    ? ["Controlled sandbox checkout and signed webhook artifacts are present, but live provider verification must be explicitly approved before PROVIDER_VERIFIED."]
    : [`Missing payment proof artifacts: ${missing.join(", ")}.`];

  return {
    provider: "PAYMENT",
    providerAccountId: input.providerAccountId,
    mode: input.mode,
    status,
    requiredArtifacts: REQUIRED_ARTIFACTS,
    missingArtifacts: missing,
    controlledCheckoutSessionId: input.controlledCheckoutSessionId,
    signedWebhookEventId: input.signedWebhookEventId,
    redactedTransactionRef: input.redactedTransactionRef,
    evidence: {
      provider: "PAYMENT",
      mode: input.mode,
      verification: status,
      capturedAt: input.capturedAt,
      controlledId: input.signedWebhookEventId ?? input.controlledCheckoutSessionId,
      redactedReceipt: redactedReceipt(input),
      notes,
    },
  };
}

export function assessPaymentProviderProofPacket(packet: PaymentProviderProofPacket): PaymentProviderProofAssessment {
  if (packet.missingArtifacts.length > 0) {
    return {
      status: "CONFIGURATION_BLOCKED",
      canClaimProviderVerified: false,
      blockers: packet.missingArtifacts.map((artifact) => `Missing ${artifact}`),
    };
  }

  return {
    status: packet.status,
    canClaimProviderVerified: false,
    blockers: ["Provider verification remains blocked until owner/controller approves real controlled sandbox evidence as PROVIDER_VERIFIED."],
  };
}
