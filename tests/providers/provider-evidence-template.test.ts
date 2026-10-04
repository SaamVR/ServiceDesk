import { describe, expect, test } from "vitest";
import { assessProviderEvidence, buildProviderEvidenceTemplate } from "../../src/server/integrations/evidence/templates";

describe("controlled provider evidence templates", () => {
  test("starts every provider proof as configuration-blocked until controlled artifacts exist", () => {
    const template = buildProviderEvidenceTemplate({
      provider: "WHATSAPP",
      mode: "SANDBOX",
      scenario: "outbound_quote_template",
      capturedAt: "2026-10-04T10:00:00.000Z",
    });

    expect(template.status).toBe("CONFIGURATION_BLOCKED");
    expect(template.requiredArtifacts).toContain("controlledProviderAccount");
    expect(template.requiredArtifacts).toContain("redactedReceiptOrEventId");
    expect(template.requiredArtifacts).toContain("operatorAttestation");
  });

  test("does not promote fixture or mock artifacts to provider-verified", () => {
    const assessed = assessProviderEvidence({
      provider: "PAYMENT",
      mode: "FIXTURE",
      scenario: "checkout_session_completed",
      capturedAt: "2026-10-04T10:00:00.000Z",
      artifacts: {
        controlledProviderAccount: true,
        controlledRecipientOrResource: true,
        redactedReceiptOrEventId: "evt_fixture_123",
        rawCallbackVerified: true,
        operatorAttestation: true,
      },
    });

    expect(assessed.status).toBe("CONTRACT_TESTED");
    expect(assessed.evidence.verification).toBe("CONTRACT_TESTED");
  });

  test("promotes controlled sandbox evidence only when all mandatory artifacts are present", () => {
    const assessed = assessProviderEvidence({
      provider: "GOOGLE_CALENDAR",
      mode: "SANDBOX",
      scenario: "calendar_create_update_cancel",
      capturedAt: "2026-10-04T10:00:00.000Z",
      artifacts: {
        controlledProviderAccount: true,
        controlledRecipientOrResource: true,
        redactedReceiptOrEventId: "gcal_evt_redacted_123",
        rawCallbackVerified: true,
        operatorAttestation: true,
      },
    });

    expect(assessed.status).toBe("PROVIDER_VERIFIED");
    expect(assessed.evidence).toMatchObject({ provider: "GOOGLE_CALENDAR", mode: "SANDBOX", verification: "PROVIDER_VERIFIED" });
    expect(assessed.evidence.redactedReceipt).toBe("gcal_evt_redacted_123");
  });

  test("keeps evidence blocked when a required artifact is missing", () => {
    const assessed = assessProviderEvidence({
      provider: "EMAIL",
      mode: "SANDBOX",
      scenario: "quote_email_delivered",
      capturedAt: "2026-10-04T10:00:00.000Z",
      artifacts: {
        controlledProviderAccount: true,
        controlledRecipientOrResource: true,
        redactedReceiptOrEventId: "mail_redacted_123",
        rawCallbackVerified: false,
        operatorAttestation: true,
      },
    });

    expect(assessed.status).toBe("CONFIGURATION_BLOCKED");
    expect(assessed.missingArtifacts).toContain("rawCallbackVerified");
  });
});
