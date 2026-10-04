import { describe, expect, test } from "vitest";
import type { WhatsAppInboundMessage } from "../../src/server/integrations/whatsapp/adapter";
import { normalizeWhatsAppInboundMessage, summarizeNormalizedInboundBatch } from "../../src/server/integrations/whatsapp/inbound-normalization";

function message(overrides: Partial<WhatsAppInboundMessage> = {}): WhatsAppInboundMessage {
  return {
    workspaceId: "ws-clearnest",
    phoneNumberId: "phone-1",
    providerMessageId: "wamid-1",
    from: "15550000000",
    timestamp: "1791108000",
    type: "text",
    text: "Need a move-out clean for 3 beds 2 baths tomorrow",
    ...overrides,
  };
}

describe("WhatsApp inbound normalization", () => {
  test("normalizes text messages into a safe conversation event", () => {
    const normalized = normalizeWhatsAppInboundMessage(message());

    expect(normalized).toMatchObject({
      provider: "WHATSAPP",
      workspaceId: "ws-clearnest",
      providerAccountId: "phone-1",
      providerMessageId: "wamid-1",
      senderRef: "15550000000",
      channel: "WHATSAPP",
      contentKind: "TEXT",
      text: "Need a move-out clean for 3 beds 2 baths tomorrow",
      rawPayloadIncluded: false,
      aiAuthoritative: false,
    });
    expect(normalized.receiptKey).toBe("ws-clearnest:phone-1:wamid-1");
  });

  test("normalizes media messages without inventing text content", () => {
    const normalized = normalizeWhatsAppInboundMessage(
      message({ providerMessageId: "wamid-image", type: "image", text: undefined, mediaId: "media-123" }),
    );

    expect(normalized).toMatchObject({
      contentKind: "MEDIA_REFERENCE",
      media: { providerMediaId: "media-123", provider: "WHATSAPP" },
      text: undefined,
      aiAuthoritative: false,
    });
  });

  test("marks unsupported inbound messages as unsupported without dropping identity", () => {
    const normalized = normalizeWhatsAppInboundMessage(message({ type: "unsupported", text: undefined, mediaId: undefined }));

    expect(normalized).toMatchObject({
      contentKind: "UNSUPPORTED",
      text: undefined,
      media: undefined,
      aiAuthoritative: false,
    });
  });

  test("summarizes normalized mixed batches for downstream processing", () => {
    const summary = summarizeNormalizedInboundBatch([
      normalizeWhatsAppInboundMessage(message({ providerMessageId: "text-1", type: "text", text: "hello" })),
      normalizeWhatsAppInboundMessage(message({ providerMessageId: "image-1", type: "image", text: undefined, mediaId: "media-1" })),
      normalizeWhatsAppInboundMessage(message({ providerMessageId: "unsupported-1", type: "unsupported", text: undefined })),
    ]);

    expect(summary).toEqual({ total: 3, text: 1, mediaReference: 1, unsupported: 1 });
  });
});
