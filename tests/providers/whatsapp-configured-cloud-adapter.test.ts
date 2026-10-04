import { describe, expect, test } from "vitest";
import type { ActorContext, CommandMeta } from "../../src/contracts";
import type { OutboxJob } from "../../src/server/integrations";
import type { WhatsAppCloudHttpTransport } from "../../src/server/integrations/whatsapp/cloud-api";
import { sendConfiguredWhatsAppCloudMessage } from "../../src/server/integrations/whatsapp/configured-adapter";

const ctx: ActorContext = { workspaceId: "ws-clearnest", role: "OWNER", userId: "owner-1" };
const meta: CommandMeta = { idempotencyKey: "cmd-1", now: "2026-10-04T12:00:00.000Z" };

const config = {
  graphBaseUrl: "https://graph.facebook.com",
  apiVersion: "v23.0",
  phoneNumberId: "123456789",
  accessToken: "super-secret-token",
  timeoutMs: 1000,
  templateLanguageCode: "en_US",
  mode: "SANDBOX" as const,
};

function baseJob(overrides: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: "job-wa-1",
    workspaceId: "ws-clearnest",
    channel: "WHATSAPP",
    purpose: "QUOTE",
    recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: false },
    createdAt: "2026-10-04T11:55:00.000Z",
    idempotencyKey: "outbox-wa-1",
    freeformText: "Your quote is ready.",
    payload: { lastInboundAt: "2026-10-04T11:30:00.000Z" },
    ...overrides,
  };
}

function acceptingTransport(capture: Array<Parameters<WhatsAppCloudHttpTransport>[0]>): WhatsAppCloudHttpTransport {
  return async (request) => {
    capture.push(request);
    return { status: 200, body: JSON.stringify({ messages: [{ id: "wamid.accepted.1" }] }) };
  };
}

describe("configured WhatsApp Cloud adapter", () => {
  test("sends in-window free-form text through Cloud API and returns provider-acceptance-only evidence", async () => {
    const calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]> = [];
    const result = await sendConfiguredWhatsAppCloudMessage(ctx, baseJob(), meta, config, acceptingTransport(calls));

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].body)).toMatchObject({ type: "text", text: { body: "Your quote is ready." } });
    if (result.ok) {
      expect(result.value).toMatchObject({
        jobId: "job-wa-1",
        providerMessageId: "wamid.accepted.1",
        mode: "SANDBOX",
        evidence: { provider: "WHATSAPP", verification: "CONTRACT_TESTED", controlledId: "wamid.accepted.1" },
      });
      expect(result.value.evidence.notes.join(" ")).toContain("Provider acceptance only");
      expect(JSON.stringify(result.value.evidence)).not.toContain("super-secret-token");
    }
  });

  test("uses approved template outside customer-service window", async () => {
    const calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]> = [];
    const result = await sendConfiguredWhatsAppCloudMessage(
      ctx,
      baseJob({
        templateKey: "quote_ready_v1",
        freeformText: "Should not be used outside window",
        payload: { lastInboundAt: "2026-10-01T12:00:00.000Z" },
      }),
      meta,
      config,
      acceptingTransport(calls),
    );

    expect(result.ok).toBe(true);
    expect(JSON.parse(calls[0].body)).toMatchObject({
      type: "template",
      template: { name: "quote_ready_v1", language: { code: "en_US" } },
    });
    expect(calls[0].body).not.toContain("Should not be used outside window");
  });

  test("sends image media payload when a media ID is supplied inside window", async () => {
    const calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]> = [];
    const result = await sendConfiguredWhatsAppCloudMessage(
      ctx,
      baseJob({ freeformText: undefined, payload: { lastInboundAt: "2026-10-04T11:30:00.000Z", mediaId: "media-123" } }),
      meta,
      config,
      acceptingTransport(calls),
    );

    expect(result.ok).toBe(true);
    expect(JSON.parse(calls[0].body)).toMatchObject({ type: "image", image: { id: "media-123" } });
  });

  test("suppresses policy failures before any provider call", async () => {
    const calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]> = [];
    const result = await sendConfiguredWhatsAppCloudMessage(
      ctx,
      baseJob({ recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: true } }),
      meta,
      config,
      acceptingTransport(calls),
    );

    expect(result).toMatchObject({ ok: false, code: "RECIPIENT_OPTED_OUT" });
    expect(calls).toHaveLength(0);
  });

  test("normalizes provider failure policy and never leaks token", async () => {
    const result = await sendConfiguredWhatsAppCloudMessage(ctx, baseJob(), meta, config, async () => ({ status: 429, body: "{}" }));

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_RATE_LIMITED" });
    expect(JSON.stringify(result)).not.toContain("super-secret-token");
  });
});
