import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import {
  handleWhatsAppHttpChallenge,
  handleWhatsAppHttpPost,
} from "../../src/server/api-handlers/provider-whatsapp-http";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-key",
  SERVICEDESK_WHATSAPP_APP_SECRET: "synthetic-meta-secret",
  SERVICEDESK_WHATSAPP_VERIFY_TOKEN: "synthetic-verify-token",
  SERVICEDESK_WHATSAPP_ACCOUNT_WORKSPACE_MAP: '{"10001001":"workspace-1"}',
};

function body(phone = "10001001", status = false) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: phone },
      ...(status ? { statuses: [{
        id: "wamid-sent", timestamp: "1791108000", status: "delivered",
      }] } : { messages: [{
        id: "wamid-inbound", from: "15550000000", timestamp: "1791108000",
        type: "text", text: { body: "Hello, please quote a deep clean" },
      }] }),
    } }] }],
  });
}
function request(raw: string, overrides: Record<string, string> = {}) {
  return new Request("https://example.test/api/providers/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": "sha256=" + createHmac("sha256", env.SERVICEDESK_WHATSAPP_APP_SECRET)
        .update(raw).digest("hex"),
      ...overrides,
    },
    body: raw,
  });
}
function fakeClient(calls: string[]) {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push(name);
      const payload = args.p_event as Record<string, string>;
      return { data: { ok: true, state: "APPLIED", conversation: {
        id: "conv-1", workspaceId: payload.workspaceId, channel: "WHATSAPP",
      }, message: {
        id: "msg-1", workspaceId: payload.workspaceId, conversationId: "conv-1",
        providerMessageId: payload.providerMessageId,
      } }, error: null };
    },
  } as unknown as SupabaseRpcClient;
}

describe("configured WhatsApp HTTP transport", () => {
  it("serves authorized Meta challenge with plaintext and no-store headers", async () => {
    const q = new URLSearchParams({
      "hub.mode": "subscribe", "hub.verify_token": "synthetic-verify-token",
      "hub.challenge": "1234567",
    });
    const response = handleWhatsAppHttpChallenge(
      new Request("https://example.test/api/providers/whatsapp?" + q), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("1234567");
    const forbidden = handleWhatsAppHttpChallenge(
      new Request("https://example.test/api/providers/whatsapp?hub.mode=subscribe&hub.challenge=1234567&hub.verify_token=wrong"), env);
    expect(forbidden.status).toBe(403);
  });

  it("applies a signed mapped inbound callback through the existing Core RPC", async () => {
    const raw = body();
    const calls: string[] = [];
    let clients = 0;
    const response = await handleWhatsAppHttpPost(request(raw), env, {
      createClient() { clients++; return fakeClient(calls); },
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(await response.text())).toEqual({
      received: 1, applied: 1, duplicate: 0, unsupported: 0,
    });
    expect(clients).toBe(1);
    expect(calls).toEqual(["servicedesk_apply_inbound_message"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("never creates a service-role client for forged or unmapped signed inputs", async () => {
    let created = 0;
    for (const bad of [
      request(body(), { "x-hub-signature-256": "sha256=" + "0".repeat(64) }),
      request(body("99999999")),
      request("null"),
    ]) {
      const response = await handleWhatsAppHttpPost(bad, env, {
        createClient() { created++; return fakeClient([]); },
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    expect(created).toBe(0);
  });

  it("fails closed on delivery statuses without the durable callback port", async () => {
    let created = 0;
    const response = await handleWhatsAppHttpPost(request(body("10001001", true)), env, {
      createClient() { created++; return fakeClient([]); },
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(created).toBe(0);
  });

  it("rejects missing runtime configuration, wrong content type and excessive bodies", async () => {
    const raw = body();
    const unavailable = await handleWhatsAppHttpPost(request(raw), {
      ...env, SERVICEDESK_WHATSAPP_APP_SECRET: "",
    });
    expect(unavailable.status).toBe(503);
    const badType = await handleWhatsAppHttpPost(request(raw, {
      "content-type": "text/plain",
    }), env);
    expect(badType.status).toBe(415);
    const oversized = await handleWhatsAppHttpPost(request("x".repeat(262145)), env);
    expect(oversized.status).toBe(413);
  });
});
