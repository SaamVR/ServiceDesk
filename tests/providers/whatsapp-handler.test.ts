import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { handleWhatsAppChallenge, handleWhatsAppInboundWebhook, providerInboxReceiptKey, type PersistProviderInboxEventInput, type ProviderInboxEventStore } from "../../src/server/api-handlers/provider-whatsapp";

function metaSignature(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

function rawMessageBody(providerMessageId = "wamid-1"): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-1" },
              messages: [
                {
                  id: providerMessageId,
                  from: "15550000000",
                  timestamp: "1791108000",
                  type: "text",
                  text: { body: "Need a move-out clean for 3 beds 2 baths in Camden tomorrow" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

function rawMultiAccountMessageBody(providerMessageId = "wamid-shared"): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-1" },
              messages: [{ id: providerMessageId, from: "contact-a", timestamp: "1791108000", type: "text", text: { body: "First account" } }],
            },
          },
          {
            value: {
              metadata: { phone_number_id: "phone-2" },
              messages: [{ id: providerMessageId, from: "contact-b", timestamp: "1791108001", type: "text", text: { body: "Second account" } }],
            },
          },
        ],
      },
    ],
  });
}

class RecordingStore implements ProviderInboxEventStore {
  readonly persisted: string[] = [];
  readonly duplicateIds = new Set<string>();
  failNext = false;

  async persistInboundMessage(input: PersistProviderInboxEventInput): Promise<"INSERTED" | "DUPLICATE"> {
    if (this.failNext) throw new Error("store unavailable");
    const receiptKey = providerInboxReceiptKey(input);
    if (this.duplicateIds.has(receiptKey)) return "DUPLICATE";
    this.persisted.push(receiptKey);
    this.duplicateIds.add(receiptKey);
    return "INSERTED";
  }
}

describe("provider-whatsapp API handler", () => {
  test("returns challenge only when verify token matches", () => {
    expect(handleWhatsAppChallenge({ "hub.mode": "subscribe", "hub.verify_token": "token", "hub.challenge": "challenge" }, "token")).toEqual({
      statusCode: 200,
      body: "challenge",
      acknowledged: true,
      retryable: false,
    });
    expect(handleWhatsAppChallenge({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "challenge" }, "token")).toMatchObject({
      statusCode: 403,
      acknowledged: false,
      retryable: false,
    });
  });

  test("verifies signature before parsing and persistence", async () => {
    const store = new RecordingStore();
    const rawBody = rawMessageBody();
    const result = await handleWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": metaSignature(rawBody, "wrong-secret") },
      appSecret: "correct-secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 401, acknowledged: false, retryable: false });
    expect(store.persisted).toEqual([]);
  });

  test("acknowledges structurally irrelevant inbound payloads without persistence", async () => {
    const store = new RecordingStore();
    const rawBody = JSON.stringify({ entry: { malformed: true } });
    const result = await handleWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": metaSignature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toEqual({ received: 0, inserted: 0, duplicate: 0 });
    expect(store.persisted).toEqual([]);
  });

  test("skips non-object inbound message entries without failing the webhook", async () => {
    const store = new RecordingStore();
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone-1" },
                messages: [null, "bad-entry", { id: "wamid-valid", from: "contact-a", timestamp: "1791108000", type: "text", text: { body: "Valid" } }],
              },
            },
          ],
        },
      ],
    });

    const result = await handleWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": metaSignature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toEqual({ received: 1, inserted: 1, duplicate: 0 });
    expect(store.persisted).toEqual(["ws-clearnest:phone-1:wamid-valid"]);
  });

  test("persists inbound message before acknowledgement", async () => {
    const store = new RecordingStore();
    const rawBody = rawMessageBody("wamid-inserted");
    const result = await handleWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": metaSignature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(store.persisted).toEqual(["ws-clearnest:phone-1:wamid-inserted"]);
  });

  test("dedupes repeated inbound provider message IDs within the same account and workspace", async () => {
    const store = new RecordingStore();
    const rawBody = rawMessageBody("wamid-duplicate");
    const first = await handleWhatsAppInboundWebhook({ rawBody, headers: { "x-hub-signature-256": metaSignature(rawBody, "secret") }, appSecret: "secret", workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" }, store });
    const second = await handleWhatsAppInboundWebhook({ rawBody, headers: { "x-hub-signature-256": metaSignature(rawBody, "secret") }, appSecret: "secret", workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" }, store });

    expect(first).toMatchObject({ statusCode: 200, acknowledged: true });
    expect(second).toMatchObject({ statusCode: 200, acknowledged: true });
    expect(JSON.parse(first.body ?? "{}")).toEqual({ received: 1, inserted: 1, duplicate: 0 });
    expect(JSON.parse(second.body ?? "{}")).toEqual({ received: 1, inserted: 0, duplicate: 1 });
    expect(store.persisted).toEqual(["ws-clearnest:phone-1:wamid-duplicate"]);
  });

  test("does not treat the same provider message id on another phone account as duplicate", async () => {
    const store = new RecordingStore();
    const rawBody = rawMultiAccountMessageBody("wamid-shared");
    const result = await handleWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": metaSignature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest", "phone-2": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toEqual({ received: 2, inserted: 2, duplicate: 0 });
    expect(store.persisted).toEqual(["ws-clearnest:phone-1:wamid-shared", "ws-clearnest:phone-2:wamid-shared"]);
  });

  test("does not acknowledge when durable persistence fails", async () => {
    const store = new RecordingStore();
    store.failNext = true;
    const rawBody = rawMessageBody("wamid-store-failure");
    const result = await handleWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": metaSignature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
