import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { QuoteDTO, VisitDTO } from "../../src/contracts";
import { FixtureCalendarAdapter, FixtureStripePaymentAdapter, FixtureWhatsAppAdapter, InMemoryInboundDedupe, parseInboundMessages, signStripeFixturePayload, verifyMetaSignature, verifyStripeSignature, verifyWhatsAppWebhookChallenge } from "../../src/server/integrations";
import type { OutboxJob } from "../../src/server/integrations";

function whatsappSignature(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

function baseJob(overrides: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: "job-1",
    workspaceId: "ws-clearnest",
    channel: "WHATSAPP",
    purpose: "QUOTE",
    recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: true, optedOut: false },
    createdAt: "2026-10-04T10:00:00.000Z",
    idempotencyKey: "idem-job-1",
    payload: { lastInboundAt: "2026-10-04T09:00:00.000Z" },
    freeformText: "Your quote is ready.",
    ...overrides,
  };
}

describe("WhatsApp provider boundary", () => {
  test("verifies webhook challenge token", () => {
    const result = verifyWhatsAppWebhookChallenge({ "hub.mode": "subscribe", "hub.verify_token": "token", "hub.challenge": "challenge-1" }, "token");
    expect(result).toEqual({ ok: true, value: "challenge-1" });
  });

  test("rejects webhook challenge token mismatch", () => {
    const result = verifyWhatsAppWebhookChallenge({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "challenge-1" }, "token");
    expect(result.ok).toBe(false);
  });

  test("verifies X-Hub-Signature-256 over raw body", () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account" });
    expect(verifyMetaSignature(rawBody, whatsappSignature(rawBody, "secret"), "secret").ok).toBe(true);
    expect(verifyMetaSignature(rawBody, whatsappSignature(rawBody, "other"), "secret").ok).toBe(false);
  });

  test("parses inbound messages only for mapped phone number IDs", () => {
    const messages = parseInboundMessages(
      {
        entry: [
          { changes: [{ value: { metadata: { phone_number_id: "phone-1" }, messages: [{ id: "wamid-1", from: "15550000000", timestamp: "1791108000", type: "text", text: { body: "Hello" } }] } }] },
          { changes: [{ value: { metadata: { phone_number_id: "unmapped" }, messages: [{ id: "wamid-2", from: "15550000001", timestamp: "1791108001", type: "text", text: { body: "Ignore" } }] } }] },
        ],
      },
      { "phone-1": "ws-clearnest" },
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ workspaceId: "ws-clearnest", providerMessageId: "wamid-1", text: "Hello" });
  });

  test("dedupes inbound provider message IDs", () => {
    const dedupe = new InMemoryInboundDedupe();
    expect(dedupe.accept("phone-1:wamid-1")).toBe(true);
    expect(dedupe.accept("phone-1:wamid-1")).toBe(false);
  });

  test("suppresses outbound on opt-out and human handover", async () => {
    const adapter = new FixtureWhatsAppAdapter(() => "2026-10-04T10:00:00.000Z");
    expect((await adapter.send(baseJob({ recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: true, optedOut: true } }))).ok).toBe(false);
    expect((await adapter.send(baseJob({ handoverGuard: { conversationId: "conv-1", expectedConversationVersion: 2, handoverActive: true } }))).ok).toBe(false);
  });

  test("requires approved template outside customer-service window", async () => {
    const adapter = new FixtureWhatsAppAdapter(() => "2026-10-06T10:00:00.000Z");
    const blocked = await adapter.send(baseJob());
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("TEMPLATE_REQUIRED");
    const templated = await adapter.send(baseJob({ templateKey: "quote_ready_v1" }));
    expect(templated.ok).toBe(true);
  });
});

describe("Google Calendar provider boundary", () => {
  const visit: VisitDTO = {
    id: "visit-1",
    workspaceId: "ws-clearnest",
    requestId: "req-1",
    quoteId: "quote-1",
    crewId: "crew-1",
    status: "CONFIRMED",
    startAt: "2026-10-10T09:00:00.000Z",
    serviceMinutes: 240,
    bufferMinutes: 30,
    version: 1,
  };

  test("creates one mapped event and returns busy range", async () => {
    const adapter = new FixtureCalendarAdapter();
    const created = await adapter.createOrUpdate(visit);
    expect(created.ok).toBe(true);
    const busy = await adapter.listBusy({ from: "2026-10-10T08:00:00.000Z", to: "2026-10-10T14:00:00.000Z" }, "crew-1");
    expect(busy.ok).toBe(true);
    if (busy.ok) expect(busy.value[0]).toMatchObject({ source: "APP_MANAGED", freshness: "FRESH" });
  });

  test("expired sync token marks calendar stale for rebuild", async () => {
    const adapter = new FixtureCalendarAdapter();
    const recovered = await adapter.recoverSync({ workspaceId: "ws-clearnest", crewId: "crew-1", calendarId: "cal-1", syncToken: "expired", stale: false });
    expect(recovered.ok).toBe(true);
    if (recovered.ok) expect(recovered.value).toMatchObject({ syncToken: undefined, stale: true });
  });
});

describe("Payment provider boundary", () => {
  const quote: QuoteDTO = {
    id: "quote-1",
    workspaceId: "ws-clearnest",
    requestId: "req-1",
    version: 1,
    status: "APPROVED",
    currency: "USD",
    subtotalMinor: 34000,
    taxMinor: 0,
    totalMinor: 34000,
    depositMinor: 8500,
    balanceMinor: 25500,
    durationMinutes: 240,
    bufferMinutes: 30,
    rateVersion: "fixture-v1",
    validUntil: "2026-10-06T10:00:00.000Z",
  };

  test("creates hosted checkout from server-derived quote and hold", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const checkout = await adapter.createCheckout({
      hold: { holdId: "hold-1", workspaceId: "ws-clearnest", quoteId: "quote-1", expiresAt: "2026-10-04T10:15:00.000Z" },
      quote,
      purpose: "DEPOSIT",
      successUrl: "https://example.test/success",
      cancelUrl: "https://example.test/cancel",
    });
    expect(checkout.ok).toBe(true);
    if (checkout.ok) expect(checkout.value.amountMinor).toBe(8500);
  });

  test("verifies Stripe-style fixture signatures", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const signature = signStripeFixturePayload(rawBody, "whsec_test", 1791108000);
    expect(verifyStripeSignature(rawBody, signature, "whsec_test").ok).toBe(true);
    expect(verifyStripeSignature(rawBody, signature, "wrong").ok).toBe(false);
  });

  test("verifies webhook account and produces facade payment event", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123", () => "2026-10-04T10:00:00.000Z");
    const rawBody = JSON.stringify({
      id: "evt_123456789",
      account: "acct_123",
      type: "checkout.session.completed",
      created: 1791108000,
      data: { object: { id: "cs_test_1234", amount_total: 8500, currency: "usd", payment_intent: "pi_1234", metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT", quoteId: "quote-1", holdId: "hold-1" } } },
    });
    const verified = await adapter.verifyWebhook(rawBody, { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) });
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.value.event).toMatchObject({ provider: "STRIPE", providerAccountId: "acct_123", amountMinor: 8500, currency: "USD" });
  });

  test("rejects webhook from different payment account", async () => {
    const adapter = new FixtureStripePaymentAdapter("whsec_test", "acct_123");
    const rawBody = JSON.stringify({
      id: "evt_wrong",
      account: "acct_other",
      type: "checkout.session.completed",
      created: 1791108000,
      data: { object: { id: "cs_test_1234", amount_total: 8500, currency: "usd", metadata: { workspaceId: "ws-clearnest", purpose: "DEPOSIT" } } },
    });
    const result = await adapter.verifyWebhook(rawBody, { "stripe-signature": signStripeFixturePayload(rawBody, "whsec_test", 1791108000) });
    expect(result.ok).toBe(false);
  });
});
