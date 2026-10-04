import { describe, expect, test } from "vitest";
import { buildV1ProviderReadinessSystem, evaluateEvidencePromotion, PROVIDER_REQUIREMENTS, validateControlledProofManifest } from "../../src/server/integrations/readiness/provider-readiness";

const buildSha = "a8711c1bffda3cd52cf9938f87ce8546ba7bef1d";
const now = "2026-10-05T00:00:00.000Z";

describe("E09 provider readiness and evidence closure", () => {
  test("represents every V1 provider, aggregates missing config, and keeps payment sandbox", () => {
    const system = buildV1ProviderReadinessSystem([
      { provider: "PAYMENT", mode: "LIVE", configuredRequirements: PROVIDER_REQUIREMENTS.PAYMENT, implementationState: "PROVIDER_VERIFIED" },
      { provider: "EMAIL", configuredRequirements: ["EMAIL_PROVIDER_ACCOUNT"] },
    ]);
    expect(system.providers.map((provider) => provider.provider).sort()).toEqual(["AI", "EMAIL", "GOOGLE_CALENDAR", "PAYMENT", "WEBHOOK_N8N", "WHATSAPP"].sort());
    const payment = system.providers.find((provider) => provider.provider === "PAYMENT");
    expect(payment?.mode).toBe("SANDBOX");
    expect(payment?.verificationState).not.toBe("PROVIDER_VERIFIED");
    expect(system.closure.missingConfiguration.EMAIL).toContain("EMAIL_API_KEY_REFERENCE");
  });

  test("enforces promotion and controlled-proof manifest rules", () => {
    expect(evaluateEvidencePromotion({ from: "IMPLEMENTED", to: "CONTRACT_TESTED", evidenceKind: "AUTHORED_TEST", executable: true, now }).allowed).toBe(false);
    expect(evaluateEvidencePromotion({ from: "IMPLEMENTED", to: "CONTRACT_TESTED", evidenceKind: "EXECUTABLE_CONTRACT_RECEIPT", executable: true, now }).allowed).toBe(true);
    const proof = { provider: "WHATSAPP" as const, operation: "whatsapp.outbound", mode: "LIVE" as const, buildSha, capturedAt: now, redactedProviderReceipt: "wamid.redacted", result: "PASS" as const, evidenceKind: "CONTROLLED_PROVIDER_RECEIPT" as const };
    expect(validateControlledProofManifest({ manifest: proof, expectedProvider: "WHATSAPP", expectedBuildSha: buildSha, now }).allowed).toBe(true);
    expect(validateControlledProofManifest({ manifest: { ...proof, capturedAt: "2026-10-01T00:00:00.000Z" }, now }).code).toBe("PROOF_STALE");
    expect(validateControlledProofManifest({ manifest: { ...proof, redactedProviderReceipt: "sk_live_bad" }, now }).code).toBe("PROOF_SECRET_MATERIAL");
  });
});
