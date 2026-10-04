import { describe, expect, test } from "vitest";
import { processDurableWhatsAppInboundBatch, type DurableWhatsAppInboundProcessor } from "../../src/server/integrations/whatsapp/inbound-processor";
import type { DurableWhatsAppInboxRecord } from "../../src/server/integrations/whatsapp/inbox-persistence";

function record(overrides: Partial<DurableWhatsAppInboxRecord> = {}): DurableWhatsAppInboxRecord {
  return {
    provider: "WHATSAPP",
    workspaceId: "ws-clearnest",
    providerAccountId: "phone-1",
    phoneNumberId: "phone-1",
    providerMessageId: "wamid-1",
    receiptKey: "ws-clearnest:phone-1:wamid-1",
    senderRef: "15550000000",
    providerTimestamp: "1791108000",
    channel: "WHATSAPP",
    contentKind: "TEXT",
    text: "Need a quote",
    rawPayloadIncluded: false,
    aiAuthoritative: false,
    rawProviderEventRef: "raw-ref-1",
    ...overrides,
  };
}

describe("idempotent durable WhatsApp inbound processor", () => {
  test("processes text and media records while keeping unsupported explicit", async () => {
    const processedKeys: string[] = [];
    const processor: DurableWhatsAppInboundProcessor = {
      async process(input) {
        processedKeys.push(input.receiptKey);
        return "PROCESSED";
      },
    };

    const result = await processDurableWhatsAppInboundBatch(
      [
        record({ receiptKey: "text", providerMessageId: "text", contentKind: "TEXT", text: "hello" }),
        record({ receiptKey: "media", providerMessageId: "media", contentKind: "MEDIA_REFERENCE", text: undefined, media: { provider: "WHATSAPP", providerMediaId: "media-1" } }),
        record({ receiptKey: "unsupported", providerMessageId: "unsupported", contentKind: "UNSUPPORTED", text: undefined, media: undefined }),
      ],
      processor,
    );

    expect(result).toEqual({ ok: true, value: { received: 3, processed: 2, duplicate: 0, unsupported: 1 } });
    expect(processedKeys).toEqual(["text", "media"]);
  });

  test("counts idempotent processor duplicates without creating another logical action", async () => {
    const processor: DurableWhatsAppInboundProcessor = {
      async process(input) {
        return input.receiptKey === "already-processed" ? "DUPLICATE" : "PROCESSED";
      },
    };

    const result = await processDurableWhatsAppInboundBatch(
      [record({ receiptKey: "new" }), record({ receiptKey: "already-processed" })],
      processor,
    );

    expect(result).toEqual({ ok: true, value: { received: 2, processed: 1, duplicate: 1, unsupported: 0 } });
  });

  test("returns typed receipt-key failure when processing throws", async () => {
    const processor: DurableWhatsAppInboundProcessor = {
      async process() {
        throw new Error("downstream unavailable");
      },
    };

    const result = await processDurableWhatsAppInboundBatch([record({ receiptKey: "failed-key" })], processor);

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_INBOUND_PROCESSING_FAILED" });
    if (!result.ok) expect(result.message).toContain("failed-key");
  });
});
