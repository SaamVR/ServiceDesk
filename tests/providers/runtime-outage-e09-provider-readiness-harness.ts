import assert from "node:assert/strict";
import { buildV1ProviderReadinessSystem, evaluateEvidencePromotion, PROVIDER_REQUIREMENTS, validateControlledProofManifest } from "../../src/server/integrations/readiness/provider-readiness";

const buildSha = "a8711c1bffda3cd52cf9938f87ce8546ba7bef1d";
const now = "2026-10-05T00:00:00.000Z";
const system = buildV1ProviderReadinessSystem([
  { provider: "PAYMENT", mode: "LIVE", configuredRequirements: PROVIDER_REQUIREMENTS.PAYMENT, implementationState: "PROVIDER_VERIFIED" },
  { provider: "EMAIL", configuredRequirements: ["EMAIL_PROVIDER_ACCOUNT"] },
  { provider: "WHATSAPP", configuredRequirements: PROVIDER_REQUIREMENTS.WHATSAPP, implementationState: "CONTRACT_TESTED" },
]);

assert.deepEqual(system.providers.map((item) => item.provider).sort(), ["AI", "EMAIL", "GOOGLE_CALENDAR", "PAYMENT", "WEBHOOK_N8N", "WHATSAPP"].sort());
assert.equal(system.providers.find((item) => item.provider === "PAYMENT")?.mode, "SANDBOX");
assert.notEqual(system.providers.find((item) => item.provider === "PAYMENT")?.verificationState, "PROVIDER_VERIFIED");
assert.ok(system.closure.missingConfiguration.EMAIL.includes("EMAIL_API_KEY_REFERENCE"));
assert.equal(system.integrationStatuses.find((item) => item.provider === "EMAIL")?.status, "BLOCKED");
assert.equal(evaluateEvidencePromotion({ from: "IMPLEMENTED", to: "CONTRACT_TESTED", evidenceKind: "EXECUTABLE_CONTRACT_RECEIPT", executable: true, now }).allowed, true);
assert.equal(evaluateEvidencePromotion({ from: "IMPLEMENTED", to: "PROVIDER_VERIFIED", evidenceKind: "CONFIGURATION", now }).allowed, false);

const whatsappProof = { provider: "WHATSAPP" as const, operation: "whatsapp.outbound", mode: "LIVE" as const, buildSha, capturedAt: now, redactedProviderReceipt: "wamid.redacted.123", result: "PASS" as const, evidenceKind: "CONTROLLED_PROVIDER_RECEIPT" as const };
assert.equal(validateControlledProofManifest({ manifest: whatsappProof, expectedProvider: "WHATSAPP", expectedBuildSha: buildSha, now }).allowed, true);
assert.equal(validateControlledProofManifest({ manifest: { ...whatsappProof, capturedAt: "2026-10-01T00:00:00.000Z" }, now }).code, "PROOF_STALE");
assert.equal(validateControlledProofManifest({ manifest: { ...whatsappProof, buildSha: "" }, now }).code, "PROOF_BUILD_MISSING");
assert.equal(validateControlledProofManifest({ manifest: { ...whatsappProof, redactedProviderReceipt: "sk_live_should_not_be_here" }, now }).code, "PROOF_SECRET_MATERIAL");
const stripeSandboxDecision = evaluateEvidencePromotion({ from: "CONTRACT_TESTED", to: "PROVIDER_VERIFIED", evidenceKind: "CONTROLLED_PROVIDER_RECEIPT", buildSha, now, controlledProof: { provider: "PAYMENT", operation: "stripe.sandbox.webhook", mode: "SANDBOX", buildSha, capturedAt: now, redactedProviderReceipt: "evt_redacted_123", result: "PASS", evidenceKind: "CONTROLLED_PROVIDER_RECEIPT" } });
assert.equal(stripeSandboxDecision.allowed, false);
console.log("runtime-outage-e09-provider-readiness-harness PASS");
