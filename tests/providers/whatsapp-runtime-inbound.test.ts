import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readWhatsAppInboundRuntimeConfig } from "../../src/server/integrations/whatsapp/inbound-config";
import { verifyMetaSignature } from "../../src/server/integrations/whatsapp/adapter";
import { handleWhatsAppRuntimeWebhook } from "../../src/server/api-handlers/provider-whatsapp-runtime";
import type { ServiceDeskFacade } from "../../src/server/core/facade";

const secret = "synthetic-meta-app-secret";
const numbers = { "10001001": "workspace-alpha", "10001002": "workspace-beta" };
const message = (id: string, phone = "10001001") => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ value: {
    metadata: { phone_number_id: phone },
    messages: [{ id, from: "15551112222", timestamp: "1791108000",
      type: "text", text: { body: "Please quote my cleaning." } }],
  } }] }],
});
function signed(rawBody: string): Record<string, string> {
  return { "X-Hub-Signature-256": "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex") };
}
function input(rawBody: string, options?: {
  apply?: Pick<ServiceDeskFacade, "applyInboundMessage">["applyInboundMessage"];
  statusStore?: Parameters<typeof handleWhatsAppRuntimeWebhook>[0]["statusStore"];
}) {
  return {
    rawBody,
    appSecret: secret,
    headers: signed(rawBody),
    workspaceByPhoneNumberId: numbers,
    store: {
      applyInboundMessage: options?.apply ?? (async () =>
        ({ ok: true as const, value: { state: "APPLIED" as const, conversation: {} as never } })),
    },
    statusStore: options?.statusStore,
  };
}

describe("configured Meta WhatsApp inbound runtime boundary", () => {
  it("maps a signed customer message to the real tenant-scoped inbound command and keeps only a digest reference", async () => {
    const events: Parameters<Pick<ServiceDeskFacade, "applyInboundMessage">["applyInboundMessage"]>[0][] = [];
    const rawBody = JSON.stringify(message("wamid.real-1"));
    const output = await handleWhatsAppRuntimeWebhook(input(rawBody, { apply: async event => {
      events.push(event);
      return { ok: true, value: { state: "APPLIED", conversation: {} as never } };
    } }));
    expect(output).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(JSON.parse(output.body!)).toEqual({ received: 1, applied: 1, duplicate: 0, unsupported: 0 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      workspaceId: "workspace-alpha",
      channel: "WHATSAPP",
      receiptKey: "workspace-alpha:10001001:wamid.real-1",
      providerMessageId: "wamid.real-1",
      senderRef: "15551112222",
      occurredAt: "2026-10-04T10:00:00.000Z",
      text: "Please quote my cleaning.",
      contentKind: "TEXT",
    });
    expect(events[0].rawProviderEventRef).toMatch(/^whatsapp_raw:workspace-alpha:10001001:[a-f0-9]{16}$/);
    expect(JSON.stringify(events[0])).not.toContain("X-Hub-Signature");
    expect(output.body).not.toContain("15551112222");
  });

  it("preserves duplicate acceptance from atomic conversation RPC", async () => {
    const result = await handleWhatsAppRuntimeWebhook(input(JSON.stringify(message("wamid.replayed")), {
      apply: async () => ({ ok: true, value: { state: "DUPLICATE", conversation: {} as never } }),
    }));
    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, body: JSON.stringify({
      received: 1, applied: 0, duplicate: 1, unsupported: 0,
    }) });
  });


  it("requires an exact hex HMAC and nonempty Meta app secret", () => {
    const rawBody = JSON.stringify(message("wamid.strict"));
    const valid = signed(rawBody)["X-Hub-Signature-256"];
    expect(verifyMetaSignature(rawBody, valid, secret)).toMatchObject({ ok: true });
    for (const forged of [valid + "garbage", valid + "00", valid.slice(0, -1), "sha256=" + "g".repeat(64)]) {
      expect(verifyMetaSignature(rawBody, forged, secret).ok).toBe(false);
    }
    expect(verifyMetaSignature(rawBody, valid, "").ok).toBe(false);
  });

  it("rejects unsigned or forged content without touching tenant storage", async () => {
    const rawBody = JSON.stringify(message("wamid.guard"));
    let writes = 0;
    for (const headers of [{}, { "x-hub-signature-256": "sha256=" + "0".repeat(64) }]) {
      const outcome = await handleWhatsAppRuntimeWebhook({
        ...input(rawBody, { apply: async () => {
          writes++;
          return { ok: true, value: { state: "APPLIED", conversation: {} as never } };
        } }),
        headers,
      });
      expect(outcome).toMatchObject({ statusCode: 401, acknowledged: false, retryable: false });
    }
    expect(writes).toBe(0);
  });

  it("refuses unmapped phone numbers before any cross-tenant write", async () => {
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [
        { value: { metadata: { phone_number_id: "10001001" }, messages: message("wamid.first").entry[0].changes[0].value.messages } },
        { value: { metadata: { phone_number_id: "99999999" }, messages: message("wamid.second").entry[0].changes[0].value.messages } },
      ] }],
    });
    let calls = 0;
    const output = await handleWhatsAppRuntimeWebhook(input(rawBody, { apply: async () => {
      calls++;
      return { ok: true, value: { state: "APPLIED", conversation: {} as never } };
    } }));
    expect(output).toMatchObject({ statusCode: 403, acknowledged: false });
    expect(calls).toBe(0);
  });

  it("requests retry for undeliverable statuses and never falsely acknowledges them", async () => {
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "10001001" },
        statuses: [{ id: "wamid.outbound", status: "delivered", timestamp: "1791108000" }],
      } }] }],
    });
    const unavailable = await handleWhatsAppRuntimeWebhook(input(rawBody));
    expect(unavailable).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
    const callbacks: string[] = [];
    const available = await handleWhatsAppRuntimeWebhook(input(rawBody, { statusStore: {
      async applyStatusCallback(event) { callbacks.push(event.providerMessageId); return "APPLIED"; },
    } }));
    expect(available).toMatchObject({ statusCode: 200, acknowledged: true });
    expect(callbacks).toEqual(["wamid.outbound"]);
  });

  it("retries database failures without leaking customer text, RPC errors or credentials", async () => {
    const rawBody = JSON.stringify(message("wamid.failing"));
    for (const apply of [
      async () => ({ ok: false as const, code: "DB_DOWN", message: "Bearer sensitive-key customer@example.test" }),
      async () => { throw new Error("secret-token customer@example.test"); },
    ]) {
      const output = await handleWhatsAppRuntimeWebhook(input(rawBody, { apply }));
      expect(output).toMatchObject({ statusCode: 503, retryable: true, acknowledged: false });
      expect(JSON.stringify(output)).not.toMatch(/sensitive-key|secret-token|customer@example.test|Please quote/);
    }
  });

  it("rejects malformed envelopes and oversized bodies before persistence", async () => {
    for (const rawBody of ["null", "[]", "not-json", "{}", "x".repeat(262_145)]) {
      const result = await handleWhatsAppRuntimeWebhook(input(rawBody));
      expect(result.statusCode).toBeGreaterThanOrEqual(400);
      expect(result.acknowledged).toBe(false);
    }
  });
});

describe("WhatsApp server-only runtime settings", () => {
  it("requires database, app signature, challenge verification and explicit tenant mapping", () => {
    const valid = {
      SUPABASE_URL: "https://synthetic-supabase.example.test",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-key",
      SERVICEDESK_WHATSAPP_APP_SECRET: secret,
      SERVICEDESK_WHATSAPP_VERIFY_TOKEN: "controlled-verify-token",
      SERVICEDESK_WHATSAPP_ACCOUNT_WORKSPACE_MAP: JSON.stringify(numbers),
    };
    expect(readWhatsAppInboundRuntimeConfig(valid)).toMatchObject({
      ok: true, value: { workspaceByPhoneNumberId: numbers },
    });
    for (const invalid of [
      { ...valid, SUPABASE_SERVICE_ROLE_KEY: "" },
      { ...valid, SERVICEDESK_WHATSAPP_APP_SECRET: "" },
      { ...valid, SERVICEDESK_WHATSAPP_VERIFY_TOKEN: "" },
      { ...valid, SERVICEDESK_WHATSAPP_ACCOUNT_WORKSPACE_MAP: "{}" },
      { ...valid, SERVICEDESK_WHATSAPP_ACCOUNT_WORKSPACE_MAP: '{"__proto__":"workspace-alpha"}' },
      { ...valid, SERVICEDESK_WHATSAPP_ACCOUNT_WORKSPACE_MAP: '{"10001001":"../bad"}' },
    ]) {
      expect(readWhatsAppInboundRuntimeConfig(invalid).ok).toBe(false);
    }
  });

  it("does not acknowledge malformed signed status callbacks or non-array message data", async () => {
    let applied = 0;
    let statusCalls = 0;
    const corruptPayloads = [
      { statuses: "delivered" },
      { statuses: [null] },
      { statuses: [{ id: "wamid-1", status: "unknown", timestamp: "1791108000" }] },
      { statuses: [{ id: 7, status: "delivered", timestamp: "1791108000" }] },
      { statuses: [{ id: "wamid-1", status: "delivered", timestamp: "bad-time" }] },
      { messages: "not-an-array" },
    ];
    for (const value of corruptPayloads) {
      const rawBody = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [{ changes: [{ value: { metadata: { phone_number_id: "10001001" }, ...value } }] }],
      });
      const outcome = await handleWhatsAppRuntimeWebhook(input(rawBody, {
        apply: async () => { applied++; return { ok: true, value: { state: "APPLIED", conversation: {} as never } }; },
        statusStore: { async applyStatusCallback() { statusCalls++; return "APPLIED"; } },
      }));
      expect(outcome).toMatchObject({ statusCode: 400, acknowledged: false, retryable: false });
    }
    expect(applied).toBe(0);
    expect(statusCalls).toBe(0);
  });

  it("retains processing for valid signed status updates with durable status port", async () => {
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "10001001" },
        statuses: [{ id: "wamid-valid", status: "read", timestamp: "1791108000" }] } }] }],
    });
    const states: string[] = [];
    const result = await handleWhatsAppRuntimeWebhook(input(rawBody, {
      statusStore: { async applyStatusCallback(callback) {
        states.push(callback.deliveryState);
        return "APPLIED";
      } },
    }));
    expect(result).toMatchObject({ statusCode: 200, acknowledged: true });
    expect(states).toEqual(["READ"]);
  });

});
