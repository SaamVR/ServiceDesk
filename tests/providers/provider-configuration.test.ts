import { describe, expect, test } from "vitest";
import { assessProviderConfiguration, buildProviderConfigurationMatrix } from "../../src/server/integrations/configuration/checks";

describe("provider configuration gates", () => {
  test("lists explicit blocked requirements for WhatsApp", () => {
    const check = assessProviderConfiguration({
      provider: "WHATSAPP",
      now: "2026-10-04T10:00:00.000Z",
      configured: { metaAppSecret: true, webhookVerifyToken: false, businessAccountId: false, phoneNumberId: false, approvedTemplates: false, controlledRecipient: false },
    });

    expect(check.status).toBe("CONFIGURATION_BLOCKED");
    expect(check.requiredConfiguration).toContain("webhookVerifyToken");
    expect(check.requiredConfiguration).toContain("controlledRecipient");
    expect(check.evidence.verification).toBe("CONFIGURATION_BLOCKED");
  });

  test("marks fully configured sandbox provider as contract-tested until live proof exists", () => {
    const check = assessProviderConfiguration({
      provider: "PAYMENT",
      now: "2026-10-04T10:00:00.000Z",
      configured: { sandboxAccount: true, webhookSecret: true, checkoutSuccessUrl: true, checkoutCancelUrl: true, controlledReceipt: true },
    });

    expect(check.status).toBe("CONTRACT_TESTED");
    expect(check.evidence.verification).toBe("CONTRACT_TESTED");
  });

  test("builds a full provider matrix without secrets or raw account IDs", () => {
    const matrix = buildProviderConfigurationMatrix("2026-10-04T10:00:00.000Z", {
      WHATSAPP: { metaAppSecret: false, webhookVerifyToken: false, businessAccountId: false, phoneNumberId: false, approvedTemplates: false, controlledRecipient: false },
      GOOGLE_CALENDAR: { oauthClient: true, redirectUri: false, refreshToken: false, selectedCalendar: false, controlledCalendar: false },
      PAYMENT: { sandboxAccount: false, webhookSecret: false, checkoutSuccessUrl: false, checkoutCancelUrl: false, controlledReceipt: false },
      EMAIL: { verifiedDomain: false, senderAddress: false, bounceWebhook: false, controlledRecipient: false },
      WEBHOOK: { endpointUrl: false, signingSecret: false, controlledReceiver: false },
      AI: { modelApiKey: false, approvedKnowledgeIndex: true, toolAllowlist: true },
    });

    expect(matrix).toHaveLength(6);
    expect(matrix.every((item) => item.evidence.notes.join(" ").includes("secret value") === false)).toBe(true);
    expect(matrix.find((item) => item.provider === "AI")?.requiredConfiguration).toContain("modelApiKey");
  });
});
