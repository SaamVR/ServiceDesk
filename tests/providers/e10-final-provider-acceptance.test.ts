import { describe, expect, it } from "vitest";
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
const driftInput = {
  coreDtos: ["RequestDTO", "QuoteDTO", "VisitDTO", "ConversationDTO", "InvoiceDTO", "IntegrationStatusDTO", "RecurrenceRuleDTO", "QualityCaseDTO", "UsageMetricDTO"],
  outboxTopics: ["conversation.reply", "calendar.visit.upsert", "calendar.visit.cancel", "visit.reminder", "recurrence.visit.materialized", "manual_payment.recorded", "quality.review.requested", "webhook.delivery"],
  deliveryPurposes: ["QUOTE", "CONFIRMATION", "VISIT_REMINDER", "INVOICE", "FEEDBACK", "CUSTOMER_REPLY", "CALENDAR_VISIT"],
  visitProjectionFields: ["workspaceId", "visitId", "crewId", "startAt", "endAt", "timezone", "idempotencyKey", "providerMappingKey", "canMutateBookingTruth"],
  productIntegrationProviders: ["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK", "AI"],
  usageLimitedOutboundPath: true,
};

describe("final E10 provider acceptance", () => {
  it("rejects false provider proof claims", () => {
    expect(validateFinalControlledProofManifest({ manifest: injected, acceptedBuildSha: buildSha, now }).code).toBe("NOT_PROVIDER_RECEIPT");
    expect(validateFinalControlledProofManifest({ manifest: { ...injected, evidenceKind: "CONTROLLED_PROVIDER_RECEIPT", buildSha: "abc1234" }, acceptedBuildSha: buildSha, now }).code).toBe("BUILD_SHA_MISMATCH");
    expect(validateFinalControlledProofManifest({ manifest: { ...injected, evidenceKind: "CONTROLLED_PROVIDER_RECEIPT", capturedAt: "2026-01-01T00:00:00.000Z" }, acceptedBuildSha: buildSha, now }).code).toBe("STALE_PROOF");
    expect(validateFinalControlledProofManifest({ manifest: { ...injected, evidenceKind: "CONTROLLED_PROVIDER_RECEIPT", redactedProviderReference: "sk_live_bad" }, acceptedBuildSha: buildSha, now }).code).toBe("SECRET_BEARING_PROOF");
  });

  it("keeps missing controlled receipts configuration-blocked while contract preflight passes", () => {
    const packet = buildFinalV1ProviderEvidencePacket({ buildSha, manifests: [injected], now });
    expect(packet.overallControlledProviderGate).toBe("CONFIGURATION_BLOCKED");
    expect(packet.missingOperations.some((item) => item.provider === "WHATSAPP" && item.operation === "inbound_signature")).toBe(true);
    expect(packet.sandboxOnlyOperations.some((item) => item.provider === "PAYMENT" && item.operation === "duplicate_idempotency")).toBe(true);
    const drift = auditFinalConnectorContractDrift(driftInput);
    const preflight = buildFinalCrossProviderPreflight({ buildSha, contractEvidenceProviders: allProviders, contractDrift: drift });
    expect(drift.pass).toBe(true);
    expect(preflight.pass).toBe(true);
    expect(preflight.mutatesCoreTruth).toBe(false);
    expect(preflight.providerVerifiedClaim).toBe(false);
  });

  it("returns a final owner action checklist without requesting raw secrets", () => {
    const report = buildFinalProviderAcceptanceReport({ buildSha, manifests: [injected], now, contractEvidenceProviders: allProviders, contractDrift: driftInput });
    expect(report.state).toBe("CONTRACT_TESTED");
    expect(report.canonicalGate).toBe("CONFIGURATION_BLOCKED");
    expect(report.noFalseProviderClaims).toBe(true);
    expect(report.controlledProviderGate).toContain("WHATSAPP:inbound_signature");
    expect(buildFinalExternalAccessChecklist(report.providerGateReport).some((line) => line.includes("PAYMENT") && line.includes("SANDBOX"))).toBe(true);
  });
});
