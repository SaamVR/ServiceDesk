import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPostgresConversationReplyIntentResolver } from "../../src/server/integrations/outbox/conversation-reply-postgres";
import { ConnectorOutboxExecutionPort } from "../../src/server/integrations/outbox/execution-adapter";
import type { ClaimedOutboxEvent } from "../../src/contracts";

const event: ClaimedOutboxEvent = {
  id: "outbox-1", workspaceId: "ws-1", topic: "conversation.reply", attempt: 1,
  claimedAt: "2026-10-11T06:00:00.000Z",
  idempotencyKey: "conversation.reply:ws-1:reviewed-key-0001",
  payload: { conversationId: "conv-1", channel: "WHATSAPP", recipient: "+15553334444", body: "Approved reply" },
};
const records: Record<string, unknown> = {
  outbox_events: { id: event.id, workspace_id: event.workspaceId, topic: event.topic,
    payload: event.payload, idempotency_key: event.idempotencyKey, status: "PENDING" },
  messages: [{ id: "message-1", workspace_id: "ws-1", conversation_id: "conv-1",
    outbox_event_id: "outbox-1", outbound_idempotency_key: "reviewed-key-0001",
    direction: "OUTBOUND", sender_kind: "STAFF", body: "Approved reply",
    created_at: "2026-10-11T05:56:00.000Z" }],
  conversations: { id: "conv-1", workspace_id: "ws-1", customer_id: "customer-1",
    version: 5, handover_active: true, channel: "WHATSAPP" },
  customer_contacts: { id: "contact-1", workspace_id: "ws-1", customer_id: "customer-1",
    kind: "PHONE", value: "+15553334444", verified_at: null },
  communication_consents: { workspace_id: "ws-1", customer_id: "customer-1",
    channel: "WHATSAPP", status: "GRANTED", recorded_at: "2026-10-11T04:00:00.000Z" },
};
const inbound = { id: "incoming-1", workspace_id: "ws-1", conversation_id: "conv-1",
  direction: "INBOUND", sender_kind: "CUSTOMER", created_at: "2026-10-11T05:45:00.000Z" };

function fake(input: { records?: Record<string, unknown>; lastInbound?: unknown;
  fail?: string } = {}) {
  const reads: Array<{ table: string; eqs: Array<[string, unknown]>; limit?: number }> = [];
  const data = { ...records, ...input.records };
  const client = {
    from(table: string) {
      const row = { table, eqs: [] as Array<[string, unknown]>, limit: undefined as number | undefined };
      reads.push(row);
      const result = () => ({
        data: table === "messages" && row.eqs.some(([k,v]) => k === "direction" && v === "INBOUND")
          ? (input.lastInbound === undefined ? inbound : input.lastInbound)
          : data[table],
        error: input.fail === table ? { message: "private customer data" } : null,
      });
      const chain = {
        select() { return chain; },
        eq(k: string, v: unknown) { row.eqs.push([k,v]); return chain; },
        order() { return chain; },
        limit(n: number) { row.limit = n; return chain; },
        maybeSingle: async () => result(),
        then: (ok: (arg: ReturnType<typeof result>) => unknown) => Promise.resolve(ok(result())),
      };
      return chain;
    },
  } as unknown as Pick<SupabaseClient,"from">;
  return { resolver: createPostgresConversationReplyIntentResolver(client), reads };
}

describe("authoritative persisted conversation.reply to provider job", () => {
  it("resolves the real deployed RPC payload without messageId from an exact outbox-linked staff message", async () => {
    const h = fake();
    const result = await h.resolver.resolve(event);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: event.id, workspaceId: "ws-1", channel: "WHATSAPP",
      purpose: "CUSTOMER_REPLY", idempotencyKey: event.idempotencyKey,
      recipient: { hasOptIn: true, consentRequired: true, recipientRef: "+15553334444" },
      payload: { messageId: "message-1", body: "Approved reply",
        conversationId: "conv-1", lastInboundAt: inbound.created_at },
      handoverGuard: { conversationId: "conv-1", expectedConversationVersion: 5,
        handoverActive: true },
    });
    expect(h.reads.map(r=>r.table)).toEqual([
      "outbox_events", "messages", "conversations",
      "customer_contacts", "communication_consents", "messages",
    ]);
    for (const read of h.reads) expect(read.eqs).toContainEqual(["workspace_id", "ws-1"]);
    expect(h.reads[1].eqs).toContainEqual(["outbox_event_id", "outbox-1"]);
  });

  it("rejects recycled event keys, contradictory claimed IDs and forged snapshot payload before send", async () => {
    for (const changed of [
      { ...event, idempotencyKey: "other-key" },
      { ...event, payload: { ...event.payload, messageId: "other-message" } },
      { ...event, payload: { ...event.payload, recipient: "other-number" } },
      { ...event, payload: { ...event.payload, body: "different reply" } },
      { ...event, topic: "retention.campaign" },
    ]) {
      expect((await fake().resolver.resolve(changed)).ok).toBe(false);
    }
  });

  it("refuses missing, multiple, cross-tenant, customer/AI authored or mismatched linked outbound messages", async () => {
    const orig = (records.messages as Array<Record<string, unknown>>)[0];
    for (const data of [
      [], [orig, orig],
      [{ ...orig, workspace_id: "ws-other" }],
      [{ ...orig, conversation_id: "conv-other" }],
      [{ ...orig, sender_kind: "AI" }],
      [{ ...orig, direction: "INBOUND" }],
      [{ ...orig, outbound_idempotency_key: "other-key" }],
      [{ ...orig, body: "different reply" }],
      [{ ...orig, created_at: "not-time" }],
    ]) {
      const h = fake({ records: { messages: data } });
      expect((await h.resolver.resolve(event)).ok).toBe(false);
      expect(h.reads.map(x => x.table)).not.toContain("customer_contacts");
    }
  });

  it("suppresses a revoked consent or contact change after the original staff approval", async () => {
    const revoked = fake({ records: {
      communication_consents: { ...records.communication_consents as object, status: "REVOKED" },
    } });
    expect(await revoked.resolver.resolve(event)).toMatchObject({
      ok: false, code: "OUTBOX_SUPPRESSED:CONSENT_NOT_GRANTED",
    });
    const moved = fake({ records: {
      customer_contacts: { ...records.customer_contacts as object, value: "+15550001111" },
    } });
    expect(await moved.resolver.resolve(event)).toMatchObject({
      ok: false, code: "OUTBOX_SUPPRESSED:RECIPIENT_CHANGED",
    });
  });

  it("suppresses a reply written before the customer's newer inbound message", async () => {
    const h = fake({ lastInbound: { ...inbound, created_at: "2026-10-11T05:59:00Z" } });
    expect(await h.resolver.resolve(event)).toMatchObject({
      ok: false, code: "OUTBOX_SUPPRESSED:NEWER_CUSTOMER_MESSAGE",
    });
  });

  it("blocks cross-workspace conversation, missing persisted consent, and untrusted SQL errors", async () => {
    for (const h of [
      fake({ records: { conversations: { ...records.conversations as object, workspace_id: "foreign" } } }),
      fake({ records: { communication_consents: null } }),
      fake({ fail: "customer_contacts" }),
      fake({ fail: "outbox_events" }),
    ]) {
      const result = await h.resolver.resolve(event);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("private customer data");
    }
  });

  it("never dispatches a revoked reply through the existing outbox execution adapter", async () => {
    const h = fake({ records: {
      communication_consents: { ...records.communication_consents as object, status: "REVOKED" },
    } });
    const adapter = new ConnectorOutboxExecutionPort({
      resolver: h.resolver, dispatchers: {
        WHATSAPP: { dispatch: async () => { throw new Error("must not be called"); } },
      }, now: () => "2026-10-11T06:05:00Z",
    });
    const result = await adapter.execute(event);
    expect(result).toMatchObject({ ok: true, value: {
      outcome: "SUPPRESSED", code: "CONSENT_NOT_GRANTED",
    } });
  });
});
