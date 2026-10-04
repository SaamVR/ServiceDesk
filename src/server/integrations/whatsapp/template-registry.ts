import type { Result } from "../../../contracts";
import type { DeliveryPurpose, ProviderMode, RedactedProviderEvidence } from "../types";

export type WhatsAppTemplateRegistryStatus = "APPROVED" | "CONFIGURED" | "MISSING" | "DISABLED";

export interface WhatsAppTemplateRegistryEntry {
  templateKey: string;
  providerTemplateName: string;
  locale: string;
  purpose: DeliveryPurpose;
  status: WhatsAppTemplateRegistryStatus;
  mode: ProviderMode;
  capturedAt: string;
}

export interface WhatsAppTemplateRequirement {
  purpose: DeliveryPurpose;
  locale: string;
}

export interface ApprovedWhatsAppTemplate {
  templateKey: string;
  providerTemplateName: string;
  locale: string;
  purpose: DeliveryPurpose;
  status: "APPROVED";
  verification: "CONTRACT_TESTED";
  evidence: RedactedProviderEvidence;
}

function evidence(entry: WhatsAppTemplateRegistryEntry): RedactedProviderEvidence {
  return {
    provider: "WHATSAPP",
    mode: entry.mode,
    verification: "CONTRACT_TESTED",
    capturedAt: entry.capturedAt,
    controlledId: entry.providerTemplateName,
    notes: [
      "Template registry is a local dispatch contract and does not prove Meta approval.",
      "Controlled Meta template approval evidence is required before PROVIDER_VERIFIED.",
    ],
  };
}

export function evaluateWhatsAppTemplateRegistration(
  entry: WhatsAppTemplateRegistryEntry | null,
  requirement: WhatsAppTemplateRequirement,
): Result<ApprovedWhatsAppTemplate> {
  if (!entry || entry.status === "MISSING") {
    return { ok: false, code: "WHATSAPP_TEMPLATE_MISSING", message: "Required WhatsApp template is not registered." };
  }
  if (entry.status === "DISABLED") {
    return { ok: false, code: "WHATSAPP_TEMPLATE_DISABLED", message: `WhatsApp template ${entry.templateKey} is disabled.` };
  }
  if (entry.purpose !== requirement.purpose) {
    return { ok: false, code: "WHATSAPP_TEMPLATE_PURPOSE_MISMATCH", message: `WhatsApp template ${entry.templateKey} does not match dispatch purpose.` };
  }
  if (entry.locale !== requirement.locale) {
    return { ok: false, code: "WHATSAPP_TEMPLATE_LOCALE_MISMATCH", message: `WhatsApp template ${entry.templateKey} does not match required locale.` };
  }
  if (entry.status !== "APPROVED") {
    return { ok: false, code: "WHATSAPP_TEMPLATE_NOT_APPROVED", message: `WhatsApp template ${entry.templateKey} is not approved for dispatch.` };
  }

  return {
    ok: true,
    value: {
      templateKey: entry.templateKey,
      providerTemplateName: entry.providerTemplateName,
      locale: entry.locale,
      purpose: entry.purpose,
      status: "APPROVED",
      verification: "CONTRACT_TESTED",
      evidence: evidence(entry),
    },
  };
}
