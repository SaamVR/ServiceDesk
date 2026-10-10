import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  handleDurableWhatsAppInboundWebhook,
  type DurableWhatsAppInboundWebhookStore,
} from "../../src/server/api-handlers/provider-whatsapp-durable";
import type { DurableWhatsAppInboundProcessor } from "../../src/server/integrations/whatsapp/inbound-processor";
import type { DurableWhatsAppInboxRecord } from "../../src/server/integrations/whatsapp/inbox-persistence";

function signature(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

function rawBody(messages: unknown[]): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-1" },
              messages,
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

class IdempotentProcessor implements DurableWhatsAppInboundProcessor {
  readonly processed = new Set<string>();
  readonly calls: string[] = [];
  failReceiptKey?: string;

  async process(record: DurableWhatsAppInboxRecord): Promise<"PROCESSED" | "DUPLICATE"> {
    this.calls.push(record.receiptKey);
    if (this.failReceiptKey === record.receiptKey) throw new Error("processor unavailable");
    if (this.processed.has(record.receiptKey)) return "DUPLICATE";
    this.processed.add(record.receiptKey);
    return "PROCESSED";
  }
}

async function callHandler(input: { store: DurableStore; processor: IdempotentProcessor; rawBody: string; appSecret?: string; signatureSecret?: string }) {
  return handleDurableWhatsAppInboundWebhook({
    rawBody: input.rawBody,
    headers: { "x-hub-signature-256": signature(input.rawBody, input.signatureSecret ?? "secret") },
    appSecret: input.appSecret ?? "secret",
    workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
    store: input.store,
    processor: input.processor,
  });
}

describe("durable WhatsApp inbound webhook handler", () => {
  test("persists then processes new text and media records before acknowledging", async () => {
    const store = new DurableStore();
    const processor = new IdempotentProcessor();
    const body = rawBody([
      { id: "wamid-text", from: "contact-a", timestamp: "1791108001", type: "text", text: { body: "Need cleaning" } },
      { id: "wamid-image", from: "contact-a", timestamp: "1791108002", type: "image", image: { id: "media-1" } },
    ]);

    const result = await callHandler({ store, processor, rawBody: body });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toEqual({ received: 2, inserted: 2, duplicate: 0, unsupported: 0, processed: 2, processingDuplicate: 0 });
    expect(store.records.map((record) => record.contentKind)).toEqual(["TEXT", "MEDIA_REFERENCE"]);
    expect(store.records[1].media).toEqual({ provider: "WHATSAPP", providerMediaId: "media-1" });
    expect(processor.calls).toEqual(["ws-clearnest:phone-1:wamid-text", "ws-clearnest:phone-1:wamid-image"]);
  });

  test("keeps unsupported content explicit and does not invoke processor for it", async () => {
    const store = new DurableStore();
    const processor = new IdempotentProcessor();
    const body = rawBody([{ id: "wamid-unsupported", from: "contact-a", timestamp: "1791108003", type: "audio" }]);

    const result = await callHandler({ store, processor, rawBody: body });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toEqual({ received: 1, inserted: 1, duplicate: 0, unsupported: 1, processed: 0, processingDuplicate: 0 });
    expect(store.records[0].contentKind).toBe("UNSUPPORTED");
    expect(processor.calls).toEqual([]);
  });

  test("invokes idempotent processor for persistence duplicates so failed downstream work can recover", async () => {
    const store = new DurableStore();
    const processor = new IdempotentProcessor();
    const body = rawBody([{ id: "wamid-retry", from: "contact-a", timestamp: "1791108004", type: "text", text: { body: "retry me" } }]);

    processor.failReceiptKey = "ws-clearnest:phone-1:wamid-retry";
    const failed = await callHandler({ store, processor, rawBody: body });

    expect(failed).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
    expect(failed.body).toContain("WHATSAPP_INBOUND_PROCESSING_FAILED");
    expect(store.seen.has("ws-clearnest:phone-1:wamid-retry")).toBe(true);

    processor.failReceiptKey = undefined;
    const retry = await callHandler({ store, processor, rawBody: body });

    expect(retry).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(retry.body ?? "{}")).toEqual({ received: 1, inserted: 0, duplicate: 1, unsupported: 0, processed: 1, processingDuplicate: 0 });
    expect(processor.processed.has("ws-clearnest:phone-1:wamid-retry")).toBe(true);
  });

  test("later provider retry after successful processing is a processor duplicate without another logical action", async () => {
    const store = new DurableStore();
    const processor = new IdempotentProcessor();
    const body = rawBody([{ id: "wamid-dup", from: "contact-a", timestamp: "1791108005", type: "text", text: { body: "duplicate" } }]);

    const first = await callHandler({ store, processor, rawBody: body });
    const second = await callHandler({ store, processor, rawBody: body });

    expect(first).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(second.body ?? "{}")).toEqual({ received: 1, inserted: 0, duplicate: 1, unsupported: 0, processed: 0, processingDuplicate: 1 });
    expect(processor.calls).toEqual(["ws-clearnest:phone-1:wamid-dup", "ws-clearnest:phone-1:wamid-dup"]);
  });

  test("returns retryable 503 without exposing persistence or processing exception material", async () => {
    const body = rawBody([
      { id: "wamid-sensitive", from: "15550123456", timestamp: "1791108010", type: "text", text: { body: "Private request" } },
    ]);
    const persistenceStore = new DurableStore();
    persistenceStore.persist = async () => {
      throw new Error("database connection failed: Bearer secret-provider-key");
    };
    const failedPersistence = await callHandler({
      store: persistenceStore,
      processor: new IdempotentProcessor(),
      rawBody: body,
    });
    expect(failedPersistence).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
    expect(failedPersistence.body).toContain("WHATSAPP_INBOUND_BATCH_PERSISTENCE_FAILED");
    expect(failedPersistence.body).not.toContain("Bearer");
    expect(failedPersistence.body).not.toContain("wamid-sensitive");
    expect(failedPersistence.body).not.toContain("15550123456");

    const processingStore = new DurableStore();
    const processingWorker = new IdempotentProcessor();
    processingWorker.process = async () => {
      throw new Error("service exception: Authorization token=secret-value for +15550123456");
    };
    const failedProcessing = await callHandler({
      store: processingStore,
      processor: processingWorker,
      rawBody: body,
    });
    expect(failedProcessing).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
    expect(failedProcessing.body).toContain("WHATSAPP_INBOUND_PROCESSING_FAILED");
    expect(failedProcessing.body).not.toContain("token=");
    expect(failedProcessing.body).not.toContain("wamid-sensitive");
    expect(failedProcessing.body).not.toContain("15550123456");
  });

  test("invalid signature never invokes durable persistence or processor", async () => {
    const store = new DurableStore();
    const processor = new IdempotentProcessor();
    const body = rawBody([{ id: "wamid-text", from: "contact-a", timestamp: "1791108001", type: "text", text: { body: "Need cleaning" } }]);

    const result = await callHandler({ store, processor, rawBody: body, appSecret: "secret", signatureSecret: "wrong" });

    expect(result).toMatchObject({ statusCode: 401, acknowledged: false, retryable: false });
    expect(store.records).toEqual([]);
    expect(processor.calls).toEqual([]);
  });
});
