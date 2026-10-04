import { describe, expect, test } from "vitest";
import { redactWhatsAppCloudRequestForEvidence, sendWhatsAppCloudMessage, type WhatsAppCloudHttpTransport } from "../../src/server/integrations/whatsapp/cloud-api";

function transport(status: number, body: unknown, capture?: (input: Parameters<WhatsAppCloudHttpTransport>[0]) => void): WhatsAppCloudHttpTransport {
  return async (input) => {
    capture?.(input);
    return { status, body: JSON.stringify(body) };
  };
}

const config = {
  graphBaseUrl: "https://graph.facebook.com",
  apiVersion: "v23.0",
  phoneNumberId: "123456789",
  accessToken: "top-secret-token",
  timeoutMs: 1000,
};

describe("WhatsApp Cloud API transport", () => {
  test("sends free-form text with encoded phone path and bearer auth", async () => {
    let captured: Parameters<WhatsAppCloudHttpTransport>[0] | undefined;
    const result = await sendWhatsAppCloudMessage(
      config,
      { to: "15551234567", kind: "text", text: "Your quote is ready." },
      transport(200, { messaging_product: "whatsapp", messages: [{ id: "wamid.real.1" }] }, (input) => { captured = input; }),
    );

    expect(result.ok).toBe(true);
    expect(captured?.url).toBe("https://graph.facebook.com/v23.0/123456789/messages");
    expect(captured?.headers.authorization).toBe("Bearer top-secret-token");
    expect(JSON.parse(captured?.body ?? "{}")).toMatchObject({
      messaging_product: "whatsapp",
      to: "15551234567",
      type: "text",
      text: { body: "Your quote is ready." },
    });
    if (result.ok) expect(result.value.providerMessageId).toBe("wamid.real.1");
  });

  test("builds template and image payloads", async () => {
    const bodies: unknown[] = [];
    const http = transport(200, { messages: [{ id: "wamid.real.2" }] }, (input) => bodies.push(JSON.parse(input.body)));

    expect((await sendWhatsAppCloudMessage(config, { to: "15551234567", kind: "template", templateName: "quote_ready_v1", languageCode: "en_US" }, http)).ok).toBe(true);
    expect((await sendWhatsAppCloudMessage(config, { to: "15551234567", kind: "image", mediaId: "media-1" }, http)).ok).toBe(true);

    expect(bodies[0]).toMatchObject({ type: "template", template: { name: "quote_ready_v1", language: { code: "en_US" } } });
    expect(bodies[1]).toMatchObject({ type: "image", image: { id: "media-1" } });
  });

  test("normalizes auth, rate-limit, and provider failures", async () => {
    const auth = await sendWhatsAppCloudMessage(config, { to: "15551234567", kind: "text", text: "Hi" }, transport(401, { error: { message: "bad token" } }));
    const rate = await sendWhatsAppCloudMessage(config, { to: "15551234567", kind: "text", text: "Hi" }, transport(429, { error: { message: "slow down" } }));
    const server = await sendWhatsAppCloudMessage(config, { to: "15551234567", kind: "text", text: "Hi" }, transport(503, { error: { message: "down" } }));

    expect(auth).toMatchObject({ ok: false, code: "WHATSAPP_CONFIGURATION_BLOCKED" });
    expect(rate).toMatchObject({ ok: false, code: "WHATSAPP_RATE_LIMITED" });
    expect(server).toMatchObject({ ok: false, code: "WHATSAPP_TRANSIENT_FAILURE" });
  });

  test("rejects malformed acceptance response and unsafe request inputs", async () => {
    const invalid = await sendWhatsAppCloudMessage(config, { to: "15551234567", kind: "text", text: "Hi" }, transport(200, { messages: [] }));
    const phone = await sendWhatsAppCloudMessage(config, { to: "not-a-phone", kind: "text", text: "Hi" }, transport(200, {}));
    const text = await sendWhatsAppCloudMessage(config, { to: "15551234567", kind: "text", text: "x".repeat(4097) }, transport(200, {}));

    expect(invalid).toMatchObject({ ok: false, code: "WHATSAPP_INVALID_RESPONSE" });
    expect(phone).toMatchObject({ ok: false, code: "WHATSAPP_INVALID_RECIPIENT" });
    expect(text).toMatchObject({ ok: false, code: "WHATSAPP_TEXT_TOO_LONG" });
  });

  test("classifies transport timeout without leaking the access token", async () => {
    const timeoutTransport: WhatsAppCloudHttpTransport = async () => {
      const error = new Error("request timed out");
      error.name = "AbortError";
      throw error;
    };
    const result = await sendWhatsAppCloudMessage(config, { to: "15551234567", kind: "text", text: "Hi" }, timeoutTransport);

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_TIMEOUT" });
    expect(JSON.stringify(result)).not.toContain("top-secret-token");
  });

  test("redacts request audit output before evidence logging", () => {
    const request = {
      url: "https://graph.facebook.com/v23.0/123456789/messages",
      method: "POST" as const,
      headers: { authorization: "Bearer top-secret-token", "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: "15551234567", type: "text", text: { body: "private customer message" } }),
      signal: new AbortController().signal,
    };

    const summary = redactWhatsAppCloudRequestForEvidence(request);

    expect(summary).toEqual({
      method: "POST",
      graphHost: "graph.facebook.com",
      apiVersion: "v23.0",
      endpoint: "messages",
      hasBearerAuthorization: true,
      bodyType: "text",
    });
    expect(JSON.stringify(summary)).not.toContain("top-secret-token");
    expect(JSON.stringify(summary)).not.toContain("15551234567");
    expect(JSON.stringify(summary)).not.toContain("private customer message");
    expect(JSON.stringify(summary)).not.toContain("123456789");
  });
});
