import { describe, expect, it } from "vitest";
import {
  buildSmallestExternalAccessPacket,
  buildV1CrossProviderJourneyPreflight,
  buildV1ProviderEvidencePacket,
  buildV1ProviderGateReport,
  validateV1ControlledProofManifest,
  validateV1ReleaseProviderClaim,
  V1_REQUIRED_PROVIDER_OPERATIONS,
  type V1ControlledProofManifest,
  type V1Provider,
} from "../../src/server/integrations/evidence/v1-provider-evidence-packet";

const buildSha = "cae7eb170b97208802065b76e20cbe9f9862c0cd";
const now = "2026-10-05T00:00:00.000Z";
const allProviders: V1Provider[] = ["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK_N8N", "AI"];
const stripeSandboxCheckout: V1ControlledProofManifest = {
  provider: "PAYMENT",
  operation: "stripe_sandbox_checkout",
  mode: "SANDBOX",
  buildSha,
  capturedAt: "2026-10-04T23:30:00.000Z",
  redactedProviderReference: "stripe_sandbox:cs_test_redacted",
  result: "PASS",
  evidenceKind: "CONTROLLED_PROVIDER_RECEIPT",
};

describe("E10 V1 provider evidence packet", () => {
  it("represents every V1 provider and keeps Stripe sandbox-only", () => {
    expect([...new Set(V1_REQUIRED_PROVIDER_OPERATIONS.map((item) => item.provider))].sort()).toEqual(allProviders.sort());
    expect(V1_REQUIRED_PROVIDER_OPERATIONS.some((item) => item.provider === "PAYMENT" && item.mode === "LIVE")).toBe(false);
  });

  it("rejects false provider proof claims", () => {
    expect(validateV1ControlledProofManifest({ manifest: stripeSandboxCheckout, acceptedBuildSha: buildSha, now }).ok).toBe(true);
    expect(validateV1ControlledProofManifest({ manifest: { ...stripeSandboxCheckout, evidenceKind: "INJECTED_TRANSPORT" }, acceptedBuildSha: buildSha, now }).code).toBe("NOT_PROVIDER_RECEIPT");
    expect(validateV1ControlledProofManifest({ manifest: { ...stripeSandboxCheckout, capturedAt: "2026-09-01T00:00:00.000Z" }, acceptedBuildSha: buildSha, now }).code).toBe("STALE_PROOF");
    expect(validateV1ControlledProofManifest({ manifest: { ...stripeSandboxCheckout, redactedProviderReference: "sk_live_secret" }, acceptedBuildSha: buildSha, now }).code).toBe("SECRET_BEARING_PROOF");
  });

  it("builds an honest evidence packet and gate report", () => {
    const packet = buildV1ProviderEvidencePacket({ buildSha, manifests: [stripeSandboxCheckout], now });
    expect(packet.overallControlledProviderGate).toBe("CONFIGURATION_BLOCKED");
    expect(packet.missingOperations.some((item) => item.provider === "WHATSAPP" && item.operation === "inbound_verified_webhook")).toBe(true);
    const report = buildV1ProviderGateReport(packet, allProviders);
    expect(report).toHaveLength(6);
    expect(report.find((item) => item.provider === "PAYMENT")?.controlledProofStatus).toBe("SANDBOX_ONLY");
    expect(buildSmallestExternalAccessPacket(report).some((line) => line.startsWith("PAYMENT:"))).toBe(false);
  });

  it("permits contract preflight without provider-verified claims", () => {
    const packet = buildV1ProviderEvidencePacket({ buildSha, manifests: [stripeSandboxCheckout], now });
    const preflight = buildV1CrossProviderJourneyPreflight({ buildSha, packet, contractEvidenceProviders: allProviders });
    expect(preflight.pass).toBe(true);
    expect(preflight.mutatesCoreTruth).toBe(false);
    expect(preflight.contractEvidenceOnly).toBe(true);
    expect(validateV1ReleaseProviderClaim(packet, { buildSha, provider: "WHATSAPP", operation: "inbound_verified_webhook", mode: "LIVE", proofReference: "wa:redacted", evidenceKind: "CONTROLLED_PROVIDER_RECEIPT" }).code).toBe("REQUIRED_OPERATION_MISSING");
    expect(validateV1ReleaseProviderClaim(packet, { buildSha, provider: "PAYMENT", operation: "stripe_sandbox_checkout", mode: "LIVE", proofReference: "stripe_sandbox:cs_test_redacted", evidenceKind: "CONTROLLED_PROVIDER_RECEIPT" }).code).toBe("STRIPE_LIVE_POLICY_INVALID");
  });
});
