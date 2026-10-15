export interface NormalizeWhatsAppFailureMetadataInput {
  providerMessageId: string;
  phoneNumberId: string;
  providerTimestamp: string;
  errorCode?: number;
  errorTitle?: string;
  errorDetails?: string;
  rawProviderEvent?: string;
}

export interface NormalizedWhatsAppFailureMetadata {
  provider: "WHATSAPP";
  providerMessageId: string;
  providerAccountId: string;
  providerTimestamp: string;
  errorCode?: number;
  errorTitle?: string;
  errorDetails?: string;
  rawPayloadIncluded: false;
}

function redact(value: string, maxLength: number): string {
  // Provider errors are untrusted text and may embed Authorization headers,
  // recipient PII, control characters or customer-supplied markup.
  return value
    .replace(/access_token=[^\s&]+/gi, "[redacted]")
    .replace(/token["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, "token:[redacted]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\+?\d{8,15}/g, "[redacted-phone]")
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu, " ")
    .slice(0, maxLength);
}

function opaqueIdentifier(value: string): string {
  return /^[A-Za-z0-9_.:-]{1,256}$/.test(value) ? value : "UNVERIFIED";
}

export function normalizeWhatsAppFailureMetadata(input: NormalizeWhatsAppFailureMetadataInput): NormalizedWhatsAppFailureMetadata {
  return {
    provider: "WHATSAPP",
    providerMessageId: opaqueIdentifier(input.providerMessageId),
    providerAccountId: opaqueIdentifier(input.phoneNumberId),
    providerTimestamp: /^\d{1,13}$/.test(input.providerTimestamp)
      ? input.providerTimestamp : "UNVERIFIED",
    errorCode: Number.isSafeInteger(input.errorCode) && (input.errorCode ?? 0) >= 0
      && (input.errorCode ?? 0) <= 9_999_999 ? input.errorCode : undefined,
    errorTitle: input.errorTitle ? redact(input.errorTitle, 180) : undefined,
    errorDetails: input.errorDetails ? redact(input.errorDetails, 600) : undefined,
    rawPayloadIncluded: false,
  };
}
