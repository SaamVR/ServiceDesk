import { containsSecretMaterial } from "./provider-readiness";

export type InboundProofChannel = "EMAIL_INBOUND" | "VOICE_INBOUND";

export interface InboundControlledProofManifest {
  channel: InboundProofChannel;
  operation: "SIGNED_INBOUND_CAPTURE";
  route: "/api/providers/email/inbound" | "/api/providers/voice/inbound";
  buildSha: string;
  capturedAt: string;
  redactedProviderReceipt: string;
  result: "PASS" | "FAIL";
  evidenceKind: "CONTROLLED_PROVIDER_RECEIPT";
}

export interface InboundControlledProofEvaluation {
  allowed: boolean;
  code:
    | "PROOF_ACCEPTED"
    | "PROOF_MISSING"
    | "PROOF_MALFORMED"
    | "PROOF_CHANNEL_MISMATCH"
    | "PROOF_ROUTE_MISMATCH"
    | "PROOF_BUILD_UNAVAILABLE"
    | "PROOF_BUILD_MISMATCH"
    | "PROOF_RESULT_NOT_PASS"
    | "PROOF_NOT_CONTROLLED_PROVIDER_RECEIPT"
    | "PROOF_RECEIPT_MISSING"
    | "PROOF_SECRET_MATERIAL"
    | "PROOF_TIMESTAMP_INVALID"
    | "PROOF_STALE";
}

const routeByChannel: Record<InboundProofChannel, InboundControlledProofManifest["route"]> = {
  EMAIL_INBOUND: "/api/providers/email/inbound",
  VOICE_INBOUND: "/api/providers/voice/inbound",
};

export function parseInboundControlledProof(value: string | undefined): InboundControlledProofManifest | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as InboundControlledProofManifest;
  } catch {
    return undefined;
  }
}

export function validateInboundControlledProof(input: {
  channel: InboundProofChannel;
  manifest?: InboundControlledProofManifest;
  expectedBuildSha?: string;
  now: string;
  maxAgeHours?: number;
}): InboundControlledProofEvaluation {
  const { manifest } = input;
  if (!manifest) return { allowed: false, code: "PROOF_MISSING" };
  if (manifest.channel !== input.channel) return { allowed: false, code: "PROOF_CHANNEL_MISMATCH" };
  if (manifest.operation !== "SIGNED_INBOUND_CAPTURE") return { allowed: false, code: "PROOF_MALFORMED" };
  if (manifest.route !== routeByChannel[input.channel]) return { allowed: false, code: "PROOF_ROUTE_MISMATCH" };
  if (!input.expectedBuildSha?.trim()) return { allowed: false, code: "PROOF_BUILD_UNAVAILABLE" };
  if (!/^[a-f0-9]{7,40}$/i.test(manifest.buildSha)) return { allowed: false, code: "PROOF_MALFORMED" };
  if (manifest.buildSha !== input.expectedBuildSha) return { allowed: false, code: "PROOF_BUILD_MISMATCH" };
  if (manifest.result !== "PASS") return { allowed: false, code: "PROOF_RESULT_NOT_PASS" };
  if (manifest.evidenceKind !== "CONTROLLED_PROVIDER_RECEIPT") {
    return { allowed: false, code: "PROOF_NOT_CONTROLLED_PROVIDER_RECEIPT" };
  }
  if (!manifest.redactedProviderReceipt?.trim() || manifest.redactedProviderReceipt.trim().length < 6) {
    return { allowed: false, code: "PROOF_RECEIPT_MISSING" };
  }
  if (containsSecretMaterial(manifest)) return { allowed: false, code: "PROOF_SECRET_MATERIAL" };

  const captured = Date.parse(manifest.capturedAt);
  const current = Date.parse(input.now);
  if (!Number.isFinite(captured) || !Number.isFinite(current)) {
    return { allowed: false, code: "PROOF_TIMESTAMP_INVALID" };
  }
  const ageHours = Math.abs(current - captured) / 3_600_000;
  if (ageHours > (input.maxAgeHours ?? 24)) return { allowed: false, code: "PROOF_STALE" };

  return { allowed: true, code: "PROOF_ACCEPTED" };
}
