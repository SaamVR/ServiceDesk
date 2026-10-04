import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  handleDurableWhatsAppInboundWebhook,
  type DurableWhatsAppInboundWebhookStore,
} from "../../src/server/api-handlers/provider-whatsapp-durable";
import type { DurableWhatsAppInboxRecord } from "../../src/server/integrations/whatsapp/inbox-persistence";

function signature(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

function rawMixedBody(): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-1" },
              messages: [
                { id: "wamid-a", from: "contact-a", timestamp: "1791108001", type: "text", text: { body: "Need cleaning" } },
                { id: "wamid-a", from: "contact-a", timestamp: "1791108002", type: "text", text: { body: "Duplicate" } },
              ],
            },
          },
          {
            value: {
              metadata: { phone_number_id: "phone-2" },
              messages: [{ id: "wamid-a", from: "contact-b", timestamp: "1791108003", type: "image", image: { id: "media-1" } }],
            },
          },
        ],
      },
    ],
  });
}

class DurableStore implements DurableWhatsAppInboundWebhookStore {
  readonly seen = new Set<string>();
  readonly records: DurableWhatsAppInboxRecord[] = [];
  failOnReceiptKey?: string;

  async persist(record: DurableWhatsAppInboxRecord): Promise<"INSERTED" | "DUPLICATE"> {
    if (record.receiptKey === this.failOnReceiptKey) throw new Error("database unavailable");
    this.records.push(record);
    if (this.seen.has(record.receiptKey)) return "DUPLICATE";
    this.seen.add(record.receiptKey);
    return "INSERTED";
  }
}

describe("durable WhatsApp inbound webhook handler", () => {
  test("persists normalized durable records with account-scoped duplicate summaries", async () => {
    const store = new DurableStore();
    const rawBody = rawMixedBody();

    const result = await handleDurableWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": signature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest", "phone-2": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toEqual({ received: 3, inserted: 2, duplicate: 1, unsupported: 0 });
    expect(store.records.map((record) => record.receiptKey)).toEqual([
      "ws-clearnest:phone-1:wamid-a",
      "ws-clearnest:phone-1:wamid-a",
      "ws-clearnest:phone-2:wamid-a",
    ]);
    expect(store.records[0].rawProviderEventRef).toMatch(/^whatsapp_raw:ws-clearnest:phone-1:[a-f0-9]{16}$/);
    expect(store.records[2].rawProviderEventRef).toMatch(/^whatsapp_raw:ws-clearnest:phone-2:[a-f0-9]{16}$/);
    expect(JSON.stringify(store.records)).not.toContain(rawBody);
  });

  test("returns retryable failure instead of acknowledging partial durable persistence", async () => {
    const store = new DurableStore();
    store.failOnReceiptKey = "ws-clearnest:phone-2:wamid-a";
    const rawBody = rawMixedBody();

    const result = await handleDurableWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": signature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest", "phone-2": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
    expect(result.body).toContain("WHATSAPP_INBOUND_BATCH_PERSISTENCE_FAILED");
  });
});
