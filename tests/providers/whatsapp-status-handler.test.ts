import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { handleWhatsAppStatusWebhook, type ProviderDeliveryStatusStore, type WhatsAppStatusCallbackInput } from "../../src/server/api-handlers/provider-whatsapp";

function signature(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

function statusPayload(status: "sent" | "delivered" | "read" | "failed", timestamp = "1791108000") {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-1" },
              statuses: [
                {
                  id: "wamid.fixture.job-1",
                  status,
                  timestamp,
                  recipient_id: "15550000000",
                  errors: status === "failed" ? [{ code: 131026, title: "Message undeliverable" }] : undefined,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function makeStore(result: "APPLIED" | "DUPLICATE" | "STALE_REGRESSION" = "APPLIED") {
  const calls: WhatsAppStatusCallbackInput[] = [];
  const store: ProviderDeliveryStatusStore = {
    async applyStatusCallback(input) {
      calls.push(input);
      return result;
    },
  };
  return { store, calls };
}

describe("handleWhatsAppStatusWebhook", () => {
  test("verifies signature before parsing and rejects invalid raw body signatures", async () => {
    const rawBody = JSON.stringify(statusPayload("delivered"));
    const { store, calls } = makeStore();

    const result = await handleWhatsAppStatusWebhook({
      rawBody,
      headers: { "x-hub-signature-256": signature(rawBody, "wrong") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 401, acknowledged: false, retryable: false });
    expect(calls).toHaveLength(0);
  });

  test("persists delivered callback as separate from provider acceptance", async () => {
    const rawBody = JSON.stringify(statusPayload("delivered"));
    const { store, calls } = makeStore();

    const result = await handleWhatsAppStatusWebhook({
      rawBody,
      headers: { "x-hub-signature-256": signature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      workspaceId: "ws-clearnest",
      provider: "WHATSAPP",
      providerAccountId: "phone-1",
      providerMessageId: "wamid.fixture.job-1",
      providerStatus: "delivered",
      deliveryState: "DELIVERED",
      recipientId: "15550000000",
    });
  });

  test("deduped callbacks are acknowledged without duplicate delivery effect", async () => {
    const rawBody = JSON.stringify(statusPayload("read"));
    const { store } = makeStore("DUPLICATE");

    const result = await handleWhatsAppStatusWebhook({
      rawBody,
      headers: { "x-hub-signature-256": signature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(result.body).toContain("duplicate");
  });

  test("stale regression callbacks are acknowledged but not applied", async () => {
    const rawBody = JSON.stringify(statusPayload("sent"));
    const { store } = makeStore("STALE_REGRESSION");

    const result = await handleWhatsAppStatusWebhook({
      rawBody,
      headers: { "x-hub-signature-256": signature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(result.body).toContain("stale");
  });

  test("persistence failure is retryable and not acknowledged", async () => {
    const rawBody = JSON.stringify(statusPayload("failed"));
    const store: ProviderDeliveryStatusStore = {
      async applyStatusCallback() {
        throw new Error("database unavailable");
      },
    };

    const result = await handleWhatsAppStatusWebhook({
      rawBody,
      headers: { "x-hub-signature-256": signature(rawBody, "secret") },
      appSecret: "secret",
      workspaceByPhoneNumberId: { "phone-1": "ws-clearnest" },
      store,
    });

    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
