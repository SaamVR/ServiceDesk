import { describe, expect, test } from "vitest";
import type { WhatsAppInboundMessage } from "../../src/server/integrations/whatsapp/adapter";
import {
  buildDurableWhatsAppInboxRecord,
  rawWhatsAppProviderEventRef,
  persistDurableWhatsAppInboundBatch,
  type DurableWhatsAppInboxStore,
} from "../../src/server/integrations/whatsapp/inbox-persistence";

function message(overrides: Partial<WhatsAppInboundMessage> = {}): WhatsAppInboundMessage {
  return {
    workspaceId: "ws-clearnest",
    phoneNumberId: "phone-1",
    providerMessageId: "wamid-1",
    from: "15550000000",
    timestamp: "1791108000",
    type: "text",
    text: "Need a quote",
    ...overrides,
  };
}

class RecordingInboxStore implements DurableWhatsAppInboxStore {
  readonly seen = new Set<string>();
  readonly records: string[] = [];
  readonly failOnReceiptKeys = new Set<string>();

  async persist(record: ReturnType<typeof buildDurableWhatsAppInboxRecord>): Promise<"INSERTED" | "DUPLICATE"> {
    if (this.failOnReceiptKeys.has(record.receiptKey)) throw new Error(`failed ${record.receiptKey}`);
    if (this.seen.has(record.receiptKey)) return "DUPLICATE";
    this.seen.add(record.receiptKey);
    this.records.push(record.receiptKey);
    return "INSERTED";
  }
}

describe("durable WhatsApp inbound batch persistence", () => {
  test("builds a deterministic redacted raw event reference", () => {
    const rawBody = JSON.stringify({ secret: "must-not-appear", entry: [] });
    const first = rawWhatsAppProviderEventRef({ workspaceId: "ws-clearnest", providerAccountId: "phone-1", rawBody });
    const second = rawWhatsAppProviderEventRef({ workspaceId: "ws-clearnest", providerAccountId: "phone-1", rawBody });

    expect(first).toBe(second);
    expect(first).toMatch(/^whatsapp_raw:ws-clearnest:phone-1:[a-f0-9]{16}$/);
    expect(first).not.toContain("secret");
    expect(first).not.toContain(rawBody);
  });

  test("builds a durable record without raw provider payload authority", () => {
    const record = buildDurableWhatsAppInboxRecord(message(), "raw-ref-1");

    expect(record).toMatchObject({
      provider: "WHATSAPP",
      workspaceId: "ws-clearnest",
      providerAccountId: "phone-1",
      providerMessageId: "wamid-1",
      senderRef: "15550000000",
      providerTimestamp: "1791108000",
      contentKind: "TEXT",
      rawProviderEventRef: "raw-ref-1",
      rawPayloadIncluded: false,
      aiAuthoritative: false,
    });
    expect(record.receiptKey).toBe("ws-clearnest:phone-1:wamid-1");
  });

  test("persists mixed inserted and duplicate messages from one webhook batch", async () => {
    const store = new RecordingInboxStore();
    const messages = [
      message({ providerMessageId: "wamid-a", phoneNumberId: "phone-1" }),
      message({ providerMessageId: "wamid-a", phoneNumberId: "phone-1" }),
      message({ providerMessageId: "wamid-a", phoneNumberId: "phone-2" }),
      message({ providerMessageId: "wamid-b", phoneNumberId: "phone-1", type: "image", text: undefined, mediaId: "media-1" }),
      message({ providerMessageId: "wamid-c", phoneNumberId: "phone-1", type: "unsupported", text: undefined }),
    ];

    const result = await persistDurableWhatsAppInboundBatch({
      messages,
      rawProviderEventRef: "raw-batch-ref",
      store,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ received: 5, inserted: 4, duplicate: 1, unsupported: 1 });
    }
    expect(store.records).toEqual([
      "ws-clearnest:phone-1:wamid-a",
      "ws-clearnest:phone-2:wamid-a",
      "ws-clearnest:phone-1:wamid-b",
      "ws-clearnest:phone-1:wamid-c",
    ]);
  });

  test("does not acknowledge a partially persisted batch as durable success", async () => {
    const store = new RecordingInboxStore();
    store.failOnReceiptKeys.add("ws-clearnest:phone-1:wamid-b");

    const result = await persistDurableWhatsAppInboundBatch({
      messages: [message({ providerMessageId: "wamid-a" }), message({ providerMessageId: "wamid-b" })],
      rawProviderEventRef: "raw-batch-ref",
      store,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WHATSAPP_INBOUND_BATCH_PERSISTENCE_FAILED");
      expect(result.message).toContain("ws-clearnest:phone-1:wamid-b");
    }
    expect(store.records).toEqual(["ws-clearnest:phone-1:wamid-a"]);
  });
});
