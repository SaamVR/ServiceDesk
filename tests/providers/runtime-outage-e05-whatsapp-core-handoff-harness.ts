import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleDurableWhatsAppInboundWebhook } from "../../src/server/api-handlers/provider-whatsapp-durable";
import {
  createSupabaseWhatsAppProviderReceiptGateway,
  createWhatsAppProviderReceiptStore,
  type SupabaseProviderInboundReceiptClient,
  type SupabaseProviderInboundReceiptRow,
  type WhatsAppProviderInboundReceiptGateway,
  type WhatsAppProviderInboundReceiptRow,
} from "../../src/server/integrations/whatsapp/provider-receipt-store";
import { createWhatsAppInboundCoreHandoffProcessor } from "../../src/server/integrations/whatsapp/inbound-core-handoff";
import { normalizeProviderTimestampToIso } from "../../src/server/integrations/whatsapp/timestamp-normalization";
import { resolveConversationReplyIntent, type ConversationReplyAuthoritativeSource } from "../../src/server/integrations/outbox/conversation-reply-intent";
import { WhatsAppCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/whatsapp-dispatcher";
import { EmailCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/email-dispatcher";
import { FixtureWhatsAppAdapter } from "../../src/server/integrations/whatsapp/adapter";
import { FixtureEmailAdapter } from "../../src/server/integrations/email/adapter";
import { buildWhatsAppDeliveryStateUpdate } from "../../src/server/integrations/whatsapp/delivery-state-bridge";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";
import type { InboundMessageApplicationOutcome } from "../../src/server/core/facade";

const now = "2026-10-04T14:40:00.000Z";
const secret = "test-app-secret";

const rawText = (id: string, type: "text" | "image" = "text", timestamp = "1791110400") => JSON.stringify({
  entry: [{
    changes: [{
      value: {
        metadata: { phone_number_id: "phone-1" },
        messages: [{
          id,
          from: "15551234567",
          timestamp,
          type,
          text: type === "text" ? { body: "Need help with my booking" } : undefined,
          image: type === "image" ? { id: "media-1" } : undefined,
        }],
      },
    }],
  }],
});

function sig(rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

class ReceiptGateway implements WhatsAppProviderInboundReceiptGateway {
  readonly rows: WhatsAppProviderInboundReceiptRow[] = [];
  async insertReceipt(row: WhatsAppProviderInboundReceiptRow) {
    assert.equal("rawBody" in row, false);
    assert.equal("text" in row, false);
    assert.equal("mediaProvider" in row, false);
    assert.equal("mediaProviderMediaId" in row, false);
    assert.equal("rawPayloadIncluded" in row, false);
    assert.equal("aiAuthoritative" in row, false);
    assert.equal(row.provider, "WHATSAPP");
    assert.equal(row.providerOccurredAt, "2026-10-04T10:40:00.000Z");
    if (this.rows.some((existing) => existing.receiptKey === row.receiptKey)) return "DUPLICATE" as const;
    this.rows.push(row);
    return "INSERTED" as const;
  }
}

class FakeSupabaseClient implements SupabaseProviderInboundReceiptClient {
  rows: SupabaseProviderInboundReceiptRow[] = [];
  duplicateOnInsert = false;
  from() {
    const client = this;
    const filters: Record<string, string> = {};
    return {
      insert(row: SupabaseProviderInboundReceiptRow) {
        return {
          select() {
            return {
              async maybeSingle() {
                if (client.duplicateOnInsert || client.rows.some((existing) => existing.receipt_key === row.receipt_key || (existing.provider === row.provider && existing.provider_account_id === row.provider_account_id && existing.provider_message_id === row.provider_message_id))) {
                  return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
                }
                client.rows.push(row);
                return { data: row, error: null };
              },
            };
          },
        };
      },
      select() {
        return {
          eq(column: string, value: string) {
            filters[column] = value;
            return this;
          },
          async maybeSingle() {
            const row = client.rows.find((candidate) => Object.entries(filters).every(([key, value]) => (candidate as Record<string, unknown>)[key] === value));
            return { data: row ?? null, error: null };
          },
        };
      },
    };
  }
}

class CorePort {
  readonly events: unknown[] = [];
  outcomes: Array<InboundMessageApplicationOutcome["state"] | Error> = [];

  async applyInboundMessage(event: any) {
    this.events.push(event);
    const outcome = this.outcomes.shift() ?? "APPLIED";
    if (outcome instanceof Error) return { ok: false as const, code: "CORE_WRITE_FAILED", message: outcome.message };
    return {
      ok: true as const,
      value: {
        state: outcome,
        conversation: { id: "conv-1", workspaceId: event.workspaceId, channel: "WHATSAPP", handoverActive: true, version: 1 },
        message: outcome === "APPLIED" ? { id: "msg-1", workspaceId: event.workspaceId, conversationId: "conv-1", direction: "INBOUND", senderKind: "CUSTOMER", createdAt: event.occurredAt } : undefined,
      },
    };
  }
}

function event(id: string, conversationId = "conv-1", messageId = "msg-out-1"): ClaimedOutboxEvent {
  return {
    id,
    workspaceId: "ws-1",
    topic: "conversation.reply",
    payload: { conversationId, messageId, body: "untrusted payload body", recipient: "attacker@example.com" },
    idempotencyKey: `idem-${id}`,
    attempt: 1,
    claimedAt: now,
  };
}

function source(partial: Partial<ConversationReplyAuthoritativeSource> = {}): ConversationReplyAuthoritativeSource {
  return {
    eventId: "outbox-1",
    workspaceId: "ws-1",
    conversationId: "conv-1",
    messageId: "msg-out-1",
    senderKind: "STAFF",
    channel: "WHATSAPP",
    recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: false },
    conversationVersion: 3,
    handoverActive: true,
    body: "Thanks, I can help.",
    lastInboundAt: "2026-10-04T14:30:00.000Z",
    ...partial,
  };
}

async function run() {
  assert.equal(normalizeProviderTimestampToIso("1791110400"), "2026-10-04T10:40:00.000Z");
  assert.equal(normalizeProviderTimestampToIso("1791110400000"), "2026-10-04T10:40:00.000Z");
  assert.equal(normalizeProviderTimestampToIso("2026-10-04T10:40:00Z"), "2026-10-04T10:40:00.000Z");
  assert.throws(() => normalizeProviderTimestampToIso("not-a-timestamp"), /PROVIDER_TIMESTAMP_INVALID/);

  const fakeSupabase = new FakeSupabaseClient();
  const supabaseGateway = createSupabaseWhatsAppProviderReceiptGateway(fakeSupabase);
  const receiptRow: WhatsAppProviderInboundReceiptRow = {
    receiptKey: "ws-1:phone-1:wamid-supa-1",
    workspaceId: "ws-1",
    provider: "WHATSAPP",
    providerAccountId: "phone-1",
    providerMessageId: "wamid-supa-1",
    senderRef: "15551234567",
    providerOccurredAt: "2026-10-04T10:40:00.000Z",
    rawProviderEventRef: "whatsapp_raw:ws-1:phone-1:abc",
    contentKind: "TEXT",
  };
  assert.equal(await supabaseGateway.insertReceipt(receiptRow), "INSERTED");
  assert.equal(await supabaseGateway.insertReceipt(receiptRow), "DUPLICATE");
  assert.deepEqual(Object.keys(fakeSupabase.rows[0]).sort(), [
    "content_kind",
    "provider",
    "provider_account_id",
    "provider_message_id",
    "provider_occurred_at",
    "raw_provider_event_ref",
    "receipt_key",
    "sender_ref",
    "workspace_id",
  ].sort());

  const gateway = new ReceiptGateway();
  const store = createWhatsAppProviderReceiptStore(gateway);
  const core = new CorePort();
  const processor = createWhatsAppInboundCoreHandoffProcessor(core);
  const raw1 = rawText("wamid-in-1");
  core.outcomes = ["APPLIED"];
  const first = await handleDurableWhatsAppInboundWebhook({
    rawBody: raw1,
    headers: { "x-hub-signature-256": sig(raw1) },
    appSecret: secret,
    workspaceByPhoneNumberId: { "phone-1": "ws-1" },
    store,
    processor,
  });
  assert.equal(first.statusCode, 200);
  assert.equal(JSON.parse(first.body ?? "{}").inserted, 1);
  assert.equal(JSON.parse(first.body ?? "{}").processed, 1);
  assert.equal(core.events.length, 1);
  assert.equal((core.events[0] as any).receiptKey, "ws-1:phone-1:wamid-in-1");
  assert.equal((core.events[0] as any).occurredAt, "2026-10-04T10:40:00.000Z");
  assert.equal((core.events[0] as any).rawProviderEventRef.startsWith("whatsapp_raw:"), true);

  const invalidTimestampRaw = rawText("bad-ts", "text", "bad-time");
  const badTimestamp = await handleDurableWhatsAppInboundWebhook({
    rawBody: invalidTimestampRaw,
    headers: { "x-hub-signature-256": sig(invalidTimestampRaw) },
    appSecret: secret,
    workspaceByPhoneNumberId: { "phone-1": "ws-1" },
    store,
    processor,
  });
  assert.equal(badTimestamp.statusCode, 503);
  assert.equal(core.events.length, 1);
  assert.equal(gateway.rows.length, 1);

  const raw2 = rawText("wamid-in-2", "image");
  core.outcomes = [new Error("temporary db outage")];
  const failed = await handleDurableWhatsAppInboundWebhook({
    rawBody: raw2,
    headers: { "x-hub-signature-256": sig(raw2) },
    appSecret: secret,
    workspaceByPhoneNumberId: { "phone-1": "ws-1" },
    store,
    processor,
  });
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.acknowledged, false);
  assert.equal(failed.retryable, true);
  assert.equal(gateway.rows.length, 2);

  core.outcomes = ["APPLIED"];
  const retry = await handleDurableWhatsAppInboundWebhook({
    rawBody: raw2,
    headers: { "x-hub-signature-256": sig(raw2) },
    appSecret: secret,
    workspaceByPhoneNumberId: { "phone-1": "ws-1" },
    store,
    processor,
  });
  assert.equal(retry.statusCode, 200);
  assert.equal(JSON.parse(retry.body ?? "{}").duplicate, 1);
  assert.equal(JSON.parse(retry.body ?? "{}").processed, 1);

  core.outcomes = ["DUPLICATE"];
  const duplicateCore = await handleDurableWhatsAppInboundWebhook({
    rawBody: raw2,
    headers: { "x-hub-signature-256": sig(raw2) },
    appSecret: secret,
    workspaceByPhoneNumberId: { "phone-1": "ws-1" },
    store,
    processor,
  });
  assert.equal(duplicateCore.statusCode, 200);
  assert.equal(JSON.parse(duplicateCore.body ?? "{}").processingDuplicate, 1);

  const invalid = await handleDurableWhatsAppInboundWebhook({
    rawBody: rawText("bad"),
    headers: { "x-hub-signature-256": "sha256=bad" },
    appSecret: secret,
    workspaceByPhoneNumberId: { "phone-1": "ws-1" },
    store,
    processor,
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(gateway.rows.length, 2);

  const mismatch = await resolveConversationReplyIntent(event("outbox-1", "wrong-conv"), { async load() { return { ok: true, value: source() }; } });
  assert.equal(mismatch.ok, false);

  const whatsappIntent = await resolveConversationReplyIntent(event("outbox-1"), { async load() { return { ok: true, value: source() }; } });
  assert.equal(whatsappIntent.ok, true);
  assert.equal(whatsappIntent.value.freeformText, "Thanks, I can help.");
  assert.equal((whatsappIntent.value.payload as any).recipient, undefined);
  const waDispatcher = new WhatsAppCommittedOutboxDispatcher(new FixtureWhatsAppAdapter(() => now));
  const waSent = await waDispatcher.dispatch({ job: whatsappIntent.value, committedAt: now, attempt: 1, expectedChannel: "WHATSAPP" });
  assert.equal(waSent.ok, true);
  assert.equal(waSent.value.outcome, "ACCEPTED");
  assert.equal(waSent.value.providerMessageId.startsWith("wamid.fixture."), true);

  const emailIntent = await resolveConversationReplyIntent(event("outbox-2"), {
    async load() {
      return { ok: true, value: source({
        eventId: "outbox-2",
        channel: "EMAIL",
        recipient: { recipientRef: "customer@example.com", consentRequired: true, hasOptIn: true, optedOut: false },
        subject: "Reply from support",
        text: "Text reply",
        html: "<p>Text reply</p>",
      }) };
    },
  });
  assert.equal(emailIntent.ok, true);
  const emailDispatcher = new EmailCommittedOutboxDispatcher(new FixtureEmailAdapter(() => now));
  const emailSent = await emailDispatcher.dispatch({ job: emailIntent.value, committedAt: now, attempt: 1, expectedChannel: "EMAIL" });
  assert.equal(emailSent.ok, true);
  assert.equal(emailSent.value.outcome, "ACCEPTED");

  const optedOutIntent = await resolveConversationReplyIntent(event("outbox-3"), {
    async load() {
      return { ok: true, value: source({
        eventId: "outbox-3",
        channel: "EMAIL",
        recipient: { recipientRef: "customer@example.com", consentRequired: true, hasOptIn: true, optedOut: true },
        subject: "Reply from support",
        text: "Text reply",
        html: "<p>Text reply</p>",
      }) };
    },
  });
  assert.equal(optedOutIntent.ok, true);
  const optedOut = await emailDispatcher.dispatch({ job: optedOutIntent.value, committedAt: now, attempt: 1, expectedChannel: "EMAIL" });
  assert.equal(optedOut.ok, true);
  assert.equal(optedOut.value.outcome, "SUPPRESSED");

  const delivery = buildWhatsAppDeliveryStateUpdate({
    workspaceId: "ws-1",
    messageId: "msg-out-1",
    providerMessageId: "wamid-out-1",
    current: { deliveryState: "PROVIDER_ACCEPTED", providerTimestamp: "1791110400", callbackKey: "sent" },
    incoming: { deliveryState: "DELIVERED", providerTimestamp: "1791110500", callbackKey: "delivered" },
  });
  assert.equal(delivery.decision.result, "APPLY");
  assert.equal(delivery.command?.deliveryState, "DELIVERED");

  const staleAfterFailed = buildWhatsAppDeliveryStateUpdate({
    workspaceId: "ws-1",
    messageId: "msg-out-1",
    providerMessageId: "wamid-out-1",
    current: { deliveryState: "FAILED", providerTimestamp: "1791110600", callbackKey: "failed" },
    incoming: { deliveryState: "READ", providerTimestamp: "1791110700", callbackKey: "read" },
  });
  assert.equal(staleAfterFailed.decision.result, "STALE_REGRESSION");
  assert.equal(staleAfterFailed.command, undefined);

  const combined = JSON.stringify({ first, failed, retry, duplicateCore, waSent, emailSent, optedOut, delivery, rows: gateway.rows, supabaseRows: fakeSupabase.rows });
  assert.equal(combined.includes("test-app-secret"), false);
  assert.equal(combined.includes("Need help with my booking"), false);
  assert.equal(combined.includes("untrusted payload body"), false);
  assert.equal(combined.includes("attacker@example.com"), false);
  console.log("runtime-outage-e05-whatsapp-core-handoff-harness PASS");
}

void run();
