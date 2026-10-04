import { describe, expect, test } from "vitest";
import { normalizeWhatsAppFailureMetadata } from "../../src/server/integrations/whatsapp/status-failure";

describe("WhatsApp status failure metadata", () => {
  test("keeps safe provider code/title/detail without raw payload or secret leakage", () => {
    const metadata = normalizeWhatsAppFailureMetadata({
      providerMessageId: "wamid-1",
      phoneNumberId: "phone-1",
      providerTimestamp: "1791108300",
      errorCode: 131026,
      errorTitle: "Message undeliverable",
      errorDetails: "Recipient is not reachable. access_token=secret should not be stored.",
      rawProviderEvent: JSON.stringify({ token: "secret", to: "15551234567" }),
    });

    expect(metadata).toEqual({
      provider: "WHATSAPP",
      providerMessageId: "wamid-1",
      providerAccountId: "phone-1",
      providerTimestamp: "1791108300",
      errorCode: 131026,
      errorTitle: "Message undeliverable",
      errorDetails: "Recipient is not reachable. [redacted] should not be stored.",
      rawPayloadIncluded: false,
    });
    expect(JSON.stringify(metadata)).not.toContain("secret");
    expect(JSON.stringify(metadata)).not.toContain("15551234567");
  });
});
