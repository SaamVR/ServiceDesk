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

function redact(value: string): string {
  return value
    .replace(/access_token=[^\s&]+/gi, "[redacted]")
    .replace(/token["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, "token:[redacted]")
    .replace(/\+?\d{8,15}/g, "[redacted-phone]");
}

export function normalizeWhatsAppFailureMetadata(input: NormalizeWhatsAppFailureMetadataInput): NormalizedWhatsAppFailureMetadata {
  return {
    provider: "WHATSAPP",
    providerMessageId: input.providerMessageId,
    providerAccountId: input.phoneNumberId,
    providerTimestamp: input.providerTimestamp,
    errorCode: input.errorCode,
    errorTitle: input.errorTitle,
    errorDetails: input.errorDetails ? redact(input.errorDetails) : undefined,
    rawPayloadIncluded: false,
  };
}
