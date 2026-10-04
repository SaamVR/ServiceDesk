import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { handleWhatsAppInboundWebhook, providerInboxReceiptKey, type PersistProviderInboxEventInput, type ProviderInboxEventStore } from "../../src/server/api-handlers/provider-whatsapp";
import { parseInboundMessages } from "../../src/server/integrations/whatsapp/adapter";

function signature(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

class RecordingStore implements ProviderInboxEventStore {
  readonly inputs: PersistProviderInboxEventInput[] = [];

  async persistInboundMessage(input: PersistProviderInboxEventInput): Promise<"INSERTED" | "DUPLICATE"> {
    this.inputs.push(input);
    return "INSERTED";
  }
}

describe("WhatsApp inbound payload validation", () => {
  test("skips malformed entry/change/value shapes without throwing", () => {
    const messages = parseInboundMessages(
      {
        entry: [
          null,
          "bad-entry",
          { changes: [null, "bad-change", { value: null }, { value: { metadata: null, messages: [] } }] },
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "phone-1" },
                  messages: [
                    null,
                    "bad-message",
                    { id: "", from: "contact-a", timestamp: "1791108000", type: "text", text: { body: "missing id" } },
                    { id: "wamid-valid", from: "contact-a", timestamp: "1791108001", type: "text", text: { body: "Valid" } },
                  ],
                },
              },
            ],
          },
        ],
      },
      { "phone-1": "ws-clearnest" },
    );

    expect(messages).toEqual([
      {
        workspaceId: "ws-clearnest",
        phoneNumberId: "phone-1",
        providerMessageId: "wamid-valid",
        from: "contact-a",
        timestamp: "1791108001",
        type: "text",
        text: "Valid",
        mediaId: undefined,
      },
    ]);
  });

  test("maps unsupported message types to explicit unsupported records without fabricating text", () => {
    const messages = parseInboundMessages(
      {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "phone-1" },
                  messages: [
                    { id: "wamid-audio", from: "contact-a", timestamp: "1791108002", type: "audio", audio: { id: "audio-1" } },
                  ],
                },
              },
            ],
          },
        ],
      },
      { "phone-1": "ws-clearnest" },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ providerMessageId: "wamid-audio", type: "unsupported" });
    expect(messages[0].text).toBeUndefined();
    expect(messages[0].mediaId).toBeUndefined();
  });

  test("persists multiple valid messages while ignoring unmapped phone numbers and incomplete records", async () => {
    const store = new RecordingStore();
    const rawBody = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "unmapped-phone" },
                messages: [{ id: "wamid-unmapped", from: "contact-x", timestamp: "1791108000", type: "text", text: { body: "Ignore" } }],
              },
            },
            {
              value: {
                metadata: { phone_number_id: "phone-1" },
                messages: [
                  { id: "wamid-1", from: "contact-a", timestamp: "1791108001", type: "text", text: { body: "Need cleaning" } },
                  { id: "wamid-2", from: "contact-a", timestamp: "1791108002", type: "image", image: { id: "media-1" } },
                  { id: "wamid-missing-from", timestamp: "1791108003", type: "text", text: { body: "Skip" } },
                ],
              },
            },
          ],
        },
      ],
    });

    const result = await handleWhatsAppInboundWebhook({
      rawBody,
      headers: { "x-hub-signature-256": signature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(result.body ?? "{}")).toEqual({ received: 2, inserted: 2, duplicate: 0 });
    expect(store.inputs.map(providerInboxReceiptKey)).toEqual(["ws-clearnest:phone-1:wamid-1", "ws-clearnest:phone-1:wamid-2"]);
    expect(store.inputs[1]).toMatchObject({ type: "image", mediaId: "media-1" });
  });
});
