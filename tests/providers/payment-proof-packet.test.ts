import { describe, expect, test } from "vitest";
import { buildPaymentProviderProofPacket, assessPaymentProviderProofPacket } from "../../src/server/integrations/payments/proof";

describe("payment controlled proof packet", () => {
  test("starts configuration-blocked until real sandbox checkout and signed webhook proof exist", () => {
    const packet = buildPaymentProviderProofPacket({
      mode: "SANDBOX",
      capturedAt: "2026-10-04T12:00:00.000Z",
      providerAccountId: "acct_123",
    });

    expect(packet.status).toBe("CONFIGURATION_BLOCKED");
    expect(packet.evidence.verification).toBe("CONFIGURATION_BLOCKED");
    expect(packet.requiredArtifacts).toContain("controlledCheckoutSessionId");
    expect(packet.requiredArtifacts).toContain("signedWebhookEventId");
    expect(JSON.stringify(packet)).not.toContain("whsec_");
    expect(JSON.stringify(packet)).not.toContain("sk_");
  });

  test("keeps completed sandbox proof contract-tested until provider verification is explicitly controlled", () => {
    const packet = buildPaymentProviderProofPacket({
      mode: "SANDBOX",
      capturedAt: "2026-10-04T12:00:00.000Z",
      providerAccountId: "acct_123",
      controlledCheckoutSessionId: "cs_test_123456789",
      signedWebhookEventId: "evt_123456789",
      redactedTransactionRef: "pi_…6789",
      operatorAttestation: "Owner observed checkout completion and signed webhook receipt in sandbox.",
    });

    expect(packet.status).toBe("CONTRACT_TESTED");
    expect(packet.evidence.verification).toBe("CONTRACT_TESTED");
    expect(assessPaymentProviderProofPacket(packet)).toMatchObject({ canClaimProviderVerified: false });
  });
});
