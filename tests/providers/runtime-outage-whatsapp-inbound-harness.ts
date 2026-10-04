import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { handleDurableWhatsAppInboundWebhook } from "../../src/server/api-handlers/provider-whatsapp-durable";
import { processDurableWhatsAppInboundBatch } from "../../src/server/integrations/whatsapp/inbound-processor";
import type { DurableWhatsAppInboundProcessor } from "../../src/server/integrations/whatsapp/inbound-processor";
import type { DurableWhatsAppInboxRecord, DurableWhatsAppInboxStore } from "../../src/server/integrations/whatsapp/inbox-persistence";

const secret = "test-secret";

function sign(rawBody: string): string {
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

class InboxStore implements DurableWhatsAppInboxStore {
  readonly seen = new Set<string>();
  readonly records: DurableWhatsAppInboxRecord[] = [];

  async persist(record: DurableWhatsAppInboxRecord): Promise<"INSERTED" | "DUPLICATE"> {
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

async function call(store: InboxStore, processor: IdempotentProcessor, body: string) {
  return handleDurableWhatsAppInboundWebhook({
    rawBody: body,
    headers: { "x-hub-signature-256": sign(body) },
    appSecret: secret,
    workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
    store,
    processor,
  });
}

async function main() {
  const textOnly = rawBody([{ id: "wamid-text", from: "contact-1", timestamp: "1791108001", type: "text", text: { body: "Need cleaning" } }]);
  const textStore = new InboxStore();
  const textProcessor = new IdempotentProcessor();
  const textResult = await call(textStore, textProcessor, textOnly);
  assert.equal(textResult.statusCode, 200);
  assert.equal(textResult.acknowledged, true);
  assert.deepEqual(JSON.parse(textResult.body ?? "{}"), { received: 1, inserted: 1, duplicate: 0, unsupported: 0, processed: 1, processingDuplicate: 0 });
  assert.deepEqual(textProcessor.calls, ["ws-clearnest:phone-1:wamid-text"]);

  const mixed = rawBody([
    { id: "wamid-media", from: "contact-1", timestamp: "1791108002", type: "image", image: { id: "media-1" } },
    { id: "wamid-unsupported", from: "contact-1", timestamp: "1791108003", type: "audio" },
  ]);
  const mixedStore = new InboxStore();
  const mixedProcessor = new IdempotentProcessor();
  const mixedResult = await call(mixedStore, mixedProcessor, mixed);
  assert.equal(mixedResult.statusCode, 200);
  assert.equal(mixedStore.records[0].contentKind, "MEDIA_REFERENCE");
  assert.deepEqual(mixedStore.records[0].media, { provider: "WHATSAPP", providerMediaId: "media-1" });
  assert.equal(mixedStore.records[1].contentKind, "UNSUPPORTED");
  assert.equal(mixedProcessor.calls.length, 1);
  assert.deepEqual(JSON.parse(mixedResult.body ?? "{}"), { received: 2, inserted: 2, duplicate: 0, unsupported: 1, processed: 1, processingDuplicate: 0 });

  const retryBody = rawBody([{ id: "wamid-retry", from: "contact-1", timestamp: "1791108004", type: "text", text: { body: "retry me" } }]);
  const retryStore = new InboxStore();
  const retryProcessor = new IdempotentProcessor();
  retryProcessor.failReceiptKey = "ws-clearnest:phone-1:wamid-retry";
  const failed = await call(retryStore, retryProcessor, retryBody);
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.acknowledged, false);
  assert.equal(failed.retryable, true);
  assert.match(failed.body ?? "", /WHATSAPP_INBOUND_PROCESSING_FAILED/);
  assert.equal(retryStore.seen.has("ws-clearnest:phone-1:wamid-retry"), true);

  retryProcessor.failReceiptKey = undefined;
  const retried = await call(retryStore, retryProcessor, retryBody);
  assert.equal(retried.statusCode, 200);
  assert.deepEqual(JSON.parse(retried.body ?? "{}"), { received: 1, inserted: 0, duplicate: 1, unsupported: 0, processed: 1, processingDuplicate: 0 });
  assert.equal(retryProcessor.processed.has("ws-clearnest:phone-1:wamid-retry"), true);

  const lateDuplicate = await call(retryStore, retryProcessor, retryBody);
  assert.equal(lateDuplicate.statusCode, 200);
  assert.deepEqual(JSON.parse(lateDuplicate.body ?? "{}"), { received: 1, inserted: 0, duplicate: 1, unsupported: 0, processed: 0, processingDuplicate: 1 });

  const invalidStore = new InboxStore();
  const invalidProcessor = new IdempotentProcessor();
  const invalid = await handleDurableWhatsAppInboundWebhook({
    rawBody: textOnly,
    headers: { "x-hub-signature-256": "sha256=bad" },
    appSecret: secret,
    workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
    store: invalidStore,
    processor: invalidProcessor,
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalidStore.records.length, 0);
  assert.equal(invalidProcessor.calls.length, 0);

  const standalone = await processDurableWhatsAppInboundBatch(mixedStore.records, mixedProcessor);
  assert.equal(standalone.ok, true);
  if (standalone.ok) assert.deepEqual(standalone.value, { received: 2, processed: 0, duplicate: 1, unsupported: 1 });

  console.log("runtime-outage-whatsapp-inbound-harness PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
