import assert from "node:assert/strict";
import {
  auditFinalConnectorContractDrift,
  buildFinalCrossProviderPreflight,
  buildFinalExternalAccessChecklist,
  buildFinalProviderAcceptanceReport,
  buildFinalV1ProviderEvidencePacket,
  validateFinalControlledProofManifest,
  type V1FinalControlledProofManifest,
  type V1FinalProvider,
} from "../../src/server/integrations/evidence/v1-final-provider-acceptance";

const buildSha = "7dbf49e4e714b5f149d9efc083b8739d44eb3935";
const now = "2026-10-05T00:00:00.000Z";
const allProviders: V1FinalProvider[] = ["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK_N8N", "AI"];
const injected: V1FinalControlledProofManifest = { provider: "WHATSAPP", operation: "inbound_signature", mode: "LIVE", buildSha, capturedAt: now, redactedProviderReference: "wa_msg_redacted_1234", result: "PASS", evidenceKind: "INJECTED_TRANSPORT" };
assert.equal(validateFinalControlledProofManifest({ manifest: injected, acceptedBuildSha: buildSha, now }).code, "NOT_PROVIDER_RECEIPT");
assert.equal(validateFinalControlledProofManifest({ manifest: { ...injected, evidenceKind: "CONTROLLED_PROVIDER_RECEIPT", buildSha: "abc1234" }, acceptedBuildSha: buildSha, now }).code, "BUILD_SHA_MISMATCH");
assert.equal(validateFinalControlledProofManifest({ manifest: { ...injected, evidenceKind: "CONTROLLED_PROVIDER_RECEIPT", capturedAt: "2026-01-01T00:00:00.000Z" }, acceptedBuildSha: buildSha, now }).code, "STALE_PROOF");
assert.equal(validateFinalControlledProofManifest({ manifest: { ...injected, evidenceKind: "CONTROLLED_PROVIDER_RECEIPT", redactedProviderReference: "sk_live_bad" }, acceptedBuildSha: buildSha, now }).code, "SECRET_BEARING_PROOF");
assert.equal(validateFinalControlledProofManifest({ manifest: { ...injected, provider: "PAYMENT", operation: "stripe_sandbox_checkout", mode: "LIVE", evidenceKind: "CONTROLLED_PROVIDER_RECEIPT" }, acceptedBuildSha: buildSha, now }).code, "STRIPE_LIVE_POLICY_INVALID");
const packet = buildFinalV1ProviderEvidencePacket({ buildSha, manifests: [injected], now });
assert.equal(packet.overallControlledProviderGate, "CONFIGURATION_BLOCKED");
assert(packet.missingOperations.some((item) => item.provider === "WHATSAPP" && item.operation === "inbound_signature"));
assert(packet.sandboxOnlyOperations.some((item) => item.provider === "PAYMENT" && item.operation === "duplicate_idempotency"));
const driftInput = {
  coreDtos: ["RequestDTO", "QuoteDTO", "VisitDTO", "ConversationDTO", "InvoiceDTO", "IntegrationStatusDTO", "RecurrenceRuleDTO", "QualityCaseDTO", "UsageMetricDTO"],
  outboxTopics: ["conversation.reply", "calendar.visit.upsert", "calendar.visit.cancel", "visit.reminder", "recurrence.visit.materialized", "manual_payment.recorded", "quality.review.requested", "webhook.delivery"],
  deliveryPurposes: ["QUOTE", "CONFIRMATION", "VISIT_REMINDER", "INVOICE", "FEEDBACK", "CUSTOMER_REPLY", "CALENDAR_VISIT"],
  visitProjectionFields: ["workspaceId", "visitId", "crewId", "startAt", "endAt", "timezone", "idempotencyKey", "providerMappingKey", "canMutateBookingTruth"],
  productIntegrationProviders: ["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK", "AI"],
  usageLimitedOutboundPath: true,
};
const drift = auditFinalConnectorContractDrift(driftInput);
assert.equal(drift.pass, true);
const preflight = buildFinalCrossProviderPreflight({ buildSha, contractEvidenceProviders: allProviders, contractDrift: drift });
assert.equal(preflight.pass, true);
assert.equal(preflight.mutatesCoreTruth, false);
assert.equal(preflight.providerVerifiedClaim, false);
const report = buildFinalProviderAcceptanceReport({ buildSha, manifests: [injected], now, contractEvidenceProviders: allProviders, contractDrift: driftInput });
assert.equal(report.state, "CONTRACT_TESTED");
assert.equal(report.canonicalGate, "CONFIGURATION_BLOCKED");
assert.equal(report.noFalseProviderClaims, true);
assert(report.controlledProviderGate.includes("WHATSAPP:inbound_signature"));
assert(buildFinalExternalAccessChecklist(report.providerGateReport).some((line) => line.includes("PAYMENT") && line.includes("SANDBOX")));
console.log("runtime-outage-e10-final-provider-acceptance-harness PASS");
