import { describe, expect, test } from "vitest";
import {
  evaluateWhatsAppTemplateRegistration,
  type WhatsAppTemplateRegistryEntry,
} from "../../src/server/integrations/whatsapp/template-registry";

function entry(overrides: Partial<WhatsAppTemplateRegistryEntry> = {}): WhatsAppTemplateRegistryEntry {
  return {
    templateKey: "quote_ready_v1",
    providerTemplateName: "quote_ready_v1",
    locale: "en_US",
    purpose: "QUOTE",
    status: "APPROVED",
    mode: "SANDBOX",
    capturedAt: "2026-10-04T12:00:00.000Z",
    ...overrides,
  };
}

describe("WhatsApp template registry boundary", () => {
  test("accepts only a purpose-matched approved template", () => {
    const result = evaluateWhatsAppTemplateRegistration(entry(), { purpose: "QUOTE", locale: "en_US" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        templateKey: "quote_ready_v1",
        providerTemplateName: "quote_ready_v1",
        locale: "en_US",
        purpose: "QUOTE",
        status: "APPROVED",
        verification: "CONTRACT_TESTED",
      });
      expect(result.value.evidence.notes.join(" ")).toContain("does not prove Meta approval");
    }
  });

  test("rejects configured but not approved templates before provider dispatch", () => {
    const result = evaluateWhatsAppTemplateRegistration(entry({ status: "CONFIGURED" }), { purpose: "QUOTE", locale: "en_US" });

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_NOT_APPROVED" });
    expect(JSON.stringify(result)).not.toContain("PROVIDER_VERIFIED");
  });

  test("rejects purpose or locale mismatch without silently substituting another template", () => {
    const wrongPurpose = evaluateWhatsAppTemplateRegistration(entry({ purpose: "REMINDER" }), { purpose: "QUOTE", locale: "en_US" });
    const wrongLocale = evaluateWhatsAppTemplateRegistration(entry({ locale: "bn_BD" }), { purpose: "QUOTE", locale: "en_US" });

    expect(wrongPurpose).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_PURPOSE_MISMATCH" });
    expect(wrongLocale).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_LOCALE_MISMATCH" });
  });

  test("reports missing or disabled templates as configuration blockers", () => {
    const missing = evaluateWhatsAppTemplateRegistration(null, { purpose: "QUOTE", locale: "en_US" });
    const disabled = evaluateWhatsAppTemplateRegistration(entry({ status: "DISABLED" }), { purpose: "QUOTE", locale: "en_US" });

    expect(missing).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_MISSING" });
    expect(disabled).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_DISABLED" });
  });
});
