import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  handleWhatsAppInboundWebhook,
  handleWhatsAppStatusWebhook,
  type ProviderDeliveryStatusStore,
  type ProviderInboxEventStore,
} from "../../src/server/api-handlers/provider-whatsapp";

const secret = "synthetic-meta-secret";
const workspaceByPhoneNumberId = { "phone-a": "ws-1" };
function signed(rawBody: string) {
  return { "x-hub-signature-256": "sha256=" +
    createHmac("sha256", secret).update(rawBody).digest("hex") };
}
function envelope(value: Record<string, unknown>): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-a" }, ...value } }] }],
  });
}
describe("legacy Meta callback safety guard", () => {
  test("never returns raw inbound persistence exceptions to signed provider callers", async () => {
    const rawBody = envelope({ messages: [
      { id: "wamid-1", from: "15550000000", timestamp: "1791108000", type: "text",
        text: { body: "My private address 123 Example Street" } },
    ] });
    const store: ProviderInboxEventStore = {
      async persistInboundMessage() { throw new Error("Bearer secret-token owner@example.test"); },
    };
    const result = await handleWhatsAppInboundWebhook({
      rawBody, headers: signed(rawBody), appSecret: secret,
      workspaceByPhoneNumberId, store,
    });
    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
    expect(JSON.stringify(result)).not.toMatch(/secret-token|owner@example.test|123 Example Street/);
  });

  test("does not throw on null, non-object entries or malformed status envelope", async () => {
    const store: ProviderDeliveryStatusStore = { async applyStatusCallback() { return "APPLIED"; } };
    for (const rawBody of [
      "null",
      "[]",
      JSON.stringify({ entry: [null, "unexpected", { changes: [null, {}, { value: null }] }] }),
      envelope({ statuses: [null, { id: 123, status: "delivered", timestamp: "1791108000" }] }),
    ]) {
      await expect(handleWhatsAppStatusWebhook({
        rawBody, headers: signed(rawBody), appSecret: secret,
        workspaceByPhoneNumberId, store,
      })).resolves.toMatchObject({ statusCode: 200, acknowledged: true });
    }
  });

  test("never reveals errors from status persistence, but requests retry", async () => {
    const rawBody = envelope({ statuses: [
      { id: "wamid-out", status: "delivered", timestamp: "1791108000" },
    ] });
    const result = await handleWhatsAppStatusWebhook({
      rawBody, headers: signed(rawBody), appSecret: secret,
      workspaceByPhoneNumberId,
      store: { async applyStatusCallback() { throw new Error("Bearer status-secret customer@example.test"); } },
    });
    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
    expect(JSON.stringify(result)).not.toMatch(/status-secret|customer@example.test/);
  });
});
