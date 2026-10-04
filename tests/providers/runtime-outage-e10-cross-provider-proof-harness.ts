import assert from "node:assert/strict";
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

assert.deepEqual([...new Set(V1_REQUIRED_PROVIDER_OPERATIONS.map((item) => item.provider))].sort(), allProviders.sort());
assert.equal(V1_REQUIRED_PROVIDER_OPERATIONS.some((item) => item.provider === "PAYMENT" && item.mode === "LIVE"), false);

const validSandboxPayment: V1ControlledProofManifest = {
  provider: "PAYMENT",
  operation: "stripe_sandbox_checkout",
  mode: "SANDBOX",
  buildSha,
  capturedAt: "2026-10-04T23:30:00.000Z",
  redactedProviderReference: "stripe_sandbox:cs_test_redacted",
  result: "PASS",
  evidenceKind: "CONTROLLED_PROVIDER_RECEIPT",
};

assert.equal(validateV1ControlledProofManifest({ manifest: validSandboxPayment, acceptedBuildSha: buildSha, now }).ok, true);
assert.equal(validateV1ControlledProofManifest({ manifest: { ...validSandboxPayment, mode: "LIVE" }, acceptedBuildSha: buildSha, now }).code, "MODE_MISMATCH");
assert.equal(validateV1ControlledProofManifest({ manifest: { ...validSandboxPayment, buildSha: "deadbeef" }, acceptedBuildSha: buildSha, now }).code, "BUILD_SHA_MISMATCH");
assert.equal(validateV1ControlledProofManifest({ manifest: { ...validSandboxPayment, capturedAt: "2026-09-01T00:00:00.000Z" }, acceptedBuildSha: buildSha, now }).code, "STALE_PROOF");
assert.equal(validateV1ControlledProofManifest({ manifest: { ...validSandboxPayment, evidenceKind: "INJECTED_TRANSPORT" }, acceptedBuildSha: buildSha, now }).code, "NOT_PROVIDER_RECEIPT");
assert.equal(validateV1ControlledProofManifest({ manifest: { ...validSandboxPayment, redactedProviderReference: "sk_live_secret" }, acceptedBuildSha: buildSha, now }).code, "SECRET_BEARING_PROOF");

const packet = buildV1ProviderEvidencePacket({ buildSha, manifests: [validSandboxPayment], now });
assert.equal(packet.overallControlledProviderGate, "CONFIGURATION_BLOCKED");
assert.equal(packet.sandboxOnlyOperations.some((item) => item.provider === "PAYMENT" && item.operation === "stripe_sandbox_checkout" && item.proofReference), true);
assert.equal(packet.missingOperations.some((item) => item.provider === "WHATSAPP" && item.operation === "inbound_verified_webhook"), true);

const report = buildV1ProviderGateReport(packet, allProviders);
assert.equal(report.length, 6);
assert.equal(report.find((item) => item.provider === "PAYMENT")?.controlledProofStatus, "SANDBOX_ONLY");
assert.ok(report.find((item) => item.provider === "WHATSAPP")?.missingConfiguration.includes("access token"));

const preflight = buildV1CrossProviderJourneyPreflight({ buildSha, packet, contractEvidenceProviders: allProviders });
assert.equal(preflight.pass, true);
assert.equal(preflight.mutatesCoreTruth, false);
assert.equal(preflight.contractEvidenceOnly, true);
assert.ok(preflight.steps.some((item) => item.step === "Stripe sandbox deposit" && item.status === "READY_FOR_CONTROLLED_PROOF"));

assert.equal(validateV1ReleaseProviderClaim(packet, { buildSha, provider: "PAYMENT", operation: "stripe_sandbox_checkout", mode: "LIVE", proofReference: "stripe_sandbox:cs_test_redacted", evidenceKind: "CONTROLLED_PROVIDER_RECEIPT" }).code, "STRIPE_LIVE_POLICY_INVALID");
assert.equal(validateV1ReleaseProviderClaim(packet, { buildSha, provider: "WHATSAPP", operation: "inbound_verified_webhook", mode: "LIVE", proofReference: "wa:redacted", evidenceKind: "CONTROLLED_PROVIDER_RECEIPT" }).code, "REQUIRED_OPERATION_MISSING");
assert.equal(validateV1ReleaseProviderClaim(packet, { buildSha, provider: "PAYMENT", operation: "stripe_sandbox_checkout", mode: "SANDBOX", proofReference: "stripe_sandbox:cs_test_redacted", evidenceKind: "INJECTED_TRANSPORT" }).code, "FALSE_PROVIDER_CLAIM");

const accessPacket = buildSmallestExternalAccessPacket(report);
assert.equal(accessPacket.some((line) => line.startsWith("PAYMENT:")), false);
assert.equal(accessPacket.length, 5);

console.log("runtime-outage-e10-cross-provider-proof-harness PASS");
