import { describe, expect, it } from "vitest";
import type { ResolvedStaffActor } from "../../src/features/operations/operational-product-runtime";
import { approveReviewedInboxReply, type ReviewedInboxReplyInput } from "../../src/server/core/reviewed-inbox-reply";

const input: ReviewedInboxReplyInput = {
  workspaceSlug: "service-desk", conversationId: "conv1", sourceMessageId: "inbound1",
  reviewedBody: "Reviewed reply", expectedVersion: 3,
  idempotencyKey: "reviewed-reply-unique-0001", confirmedByStaff: true,
};
const conversation = { id: "conv1", workspace_id: "ws1", channel: "WHATSAPP", version: 3, customer_id: "cust1" };
const source = { id: "inbound1", workspace_id: "ws1", conversation_id: "conv1", direction: "INBOUND",
  sender_kind: "CUSTOMER", created_at: "2026-10-11T05:00:00.000Z" };
const delivered = {
  id: "outbound1", workspaceId: "ws1", conversationId: "conv1", direction: "OUTBOUND",
  senderKind: "STAFF", body: "Reviewed reply", deliveryState: "QUEUED",
  createdAt: "2026-10-11T05:05:00.000Z",
};
function harness(options: {
  authorized?: boolean; branchDenied?: boolean;
  actorRole?: "OWNER" | "DISPATCHER" | "CREW";
  conversation?: Record<string, unknown> | null;
  source?: Record<string, unknown> | null;
  existing?: Record<string, unknown> | null;
  priorOutbox?: Record<string, unknown> | null;
  outgoing?: Record<string, unknown>;
  rpcError?: string;
  responseCode?: string;
  throwRead?: boolean;
} = {}) {
  const reads: string[] = [];
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  let branchChecks = 0;
  const lookup = (table: string) => {
    const filters: Array<[string, string]> = [];
    const query = {
      eq(column: string, value: string) { filters.push([column, value]); return this; },
      order() { return this; },
      limit() { return this; },
      async maybeSingle() {
        if (options.throwRead) throw new Error("Private message data");
        reads.push(table);
        const data = table === "conversations"
          ? (options.conversation === undefined ? conversation : options.conversation)
          : table === "outbox_events"
            ? (options.priorOutbox === undefined ? null : options.priorOutbox)
            : filters.some(([key]) => key === "outbound_idempotency_key")
              ? (options.existing === undefined ? null : options.existing)
              : (options.source === undefined ? source : options.source);
        if (data && filters.some(([k, v]) => (data as Record<string, unknown>)[k] !== v)) {
          return { data: null, error: null };
        }
        return { data, error: null };
      },
    };
    return { select: () => query };
  };
  const resolved = {
    workspace: { id: "ws1", slug: "service-desk", name: "Service Desk", timezone: "UTC", currency: "USD" },
    actor: { workspaceId: "ws1", role: options.actorRole ?? "OWNER", userId: "owner1" },
    service: { from: lookup },
    rpc: {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, arguments: args });
        if (options.rpcError) return { data: null, error: { message: options.rpcError } };
        if (options.responseCode) return { data: { ok: false, code: options.responseCode }, error: null };
        return { data: { ok: true, outboxEventId: "outbox1",
          message: options.outgoing ?? delivered }, error: null };
      },
    },
  } as unknown as ResolvedStaffActor;
  const deps = {
    resolveActor: async (_slug: string) => options.authorized === false
      ? { ok: false as const, kind: "authentication", message: "not signed in" }
      : { ok: true as const, value: resolved },
    async requireBranch() {
      branchChecks++;
      return options.branchDenied ? { ok: false, message: "not assigned" } : undefined;
    },
  };
  return { deps, reads, calls, getBranchChecks: () => branchChecks };
}
describe("explicit human approval of reviewed inbox reply", () => {
  it("queues exactly one consent-checked existing RPC with actor, optimistic version and stable idempotency key", async () => {
    const h = harness();
    expect(await approveReviewedInboxReply(input, h.deps)).toEqual({
      ok: true, value: {
        state: "QUEUED_FOR_PROVIDER", workspaceId: "ws1", conversationId: "conv1",
        sourceMessageId: "inbound1", outboundMessageId: "outbound1",
        outboxEventId: "outbox1", deliveryState: "QUEUED",
      },
    });
    expect(h.reads).toEqual(["conversations", "messages", "messages"]);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].name).toBe("servicedesk_enqueue_conversation_reply");
    expect(h.calls[0].arguments.p_input).toMatchObject({
      workspaceId: "ws1", actorUserId: "owner1", actorRole: "OWNER",
      conversationId: "conv1", expectedVersion: 3, body: "Reviewed reply",
      channel: "WHATSAPP", idempotencyKey: "reviewed-reply-unique-0001",
    });
  });

  it("returns the prior durable receipt after the first approval incremented conversation version", async () => {
    const h = harness({
      conversation: { ...conversation, version: 4 },
      existing: { id: "existing-outbound", workspace_id: "ws1",
        conversation_id: "conv1", direction: "OUTBOUND", sender_kind: "STAFF",
        outbound_idempotency_key: "reviewed-reply-unique-0001",
        outbox_event_id: "existing-outbox", body: "Reviewed reply",
        delivery_state: "QUEUED", created_at: "2026-10-11T05:05:00Z" },
      priorOutbox: { id: "existing-outbox", workspace_id: "ws1",
        topic: "conversation.reply",
        idempotency_key: "conversation.reply:ws1:reviewed-reply-unique-0001",
        status: "PENDING", provider_reference: null },
    });
    expect(await approveReviewedInboxReply(input, h.deps)).toMatchObject({
      ok: true, value: {
        state: "EXISTING_REPLY", outboundMessageId: "existing-outbound",
        outboxEventId: "existing-outbox", deliveryState: "QUEUED",
      },
    });
    expect(h.calls).toHaveLength(0);
    expect(h.reads).toEqual(["conversations", "messages", "messages", "outbox_events"]);
  });

  it("does not confuse a provider-accepted outbox with delivered/read customer status", async () => {
    const h = harness({
      conversation: { ...conversation, version: 5 },
      existing: { id: "existing-outbound", workspace_id: "ws1",
        conversation_id: "conv1", direction: "OUTBOUND", sender_kind: "STAFF",
        outbound_idempotency_key: input.idempotencyKey,
        outbox_event_id: "existing-outbox", body: "Reviewed reply",
        delivery_state: "QUEUED", created_at: "2026-10-11T05:05:00Z" },
      priorOutbox: { id: "existing-outbox", workspace_id: "ws1",
        topic: "conversation.reply",
        idempotency_key: "conversation.reply:ws1:reviewed-reply-unique-0001",
        status: "SENT", provider_reference: "provider-accepted-not-delivered" },
    });
    const result = await approveReviewedInboxReply(input, h.deps);
    expect(result).toMatchObject({ ok: true, value: {
      state: "EXISTING_REPLY", deliveryState: "PROVIDER_ACCEPTED",
    } });
    expect(JSON.stringify(result)).not.toContain("provider-accepted-not-delivered");
    expect(h.calls).toHaveLength(0);
  });

  it("refuses a reused idempotency key with different body, tenant, source chronology or outbox", async () => {
    const valid = { id: "outbound1", workspace_id: "ws1",
      conversation_id: "conv1", outbound_idempotency_key: input.idempotencyKey,
      outbox_event_id: "outbox1", direction: "OUTBOUND", sender_kind: "STAFF",
      body: "Reviewed reply", delivery_state: "QUEUED",
      created_at: "2026-10-11T05:05:00Z" };
    const outbox = { id: "outbox1", workspace_id: "ws1",
      topic: "conversation.reply", status: "PENDING", provider_reference: null,
      idempotency_key: "conversation.reply:ws1:reviewed-reply-unique-0001" };
    for (const h of [
      harness({ existing: { ...valid, body: "Other body" }, priorOutbox: outbox }),
      harness({ existing: { ...valid, conversation_id: "other-conversation" }, priorOutbox: outbox }),
      harness({ existing: { ...valid, created_at: "2026-10-11T04:00:00Z" }, priorOutbox: outbox }),
      harness({ existing: valid, priorOutbox: { ...outbox, topic: "retention.campaign" } }),
      harness({ existing: valid, priorOutbox: null }),
    ]) {
      expect(await approveReviewedInboxReply(input, h.deps))
        .toMatchObject({ ok: false, code: "REVIEWED_REPLY_RECEIPT_MISMATCH" });
      expect(h.calls).toHaveLength(0);
    }
  });

  it("requires actual staff confirmation and valid input before accessing database", async () => {
    for (const change of [
      { confirmedByStaff: false }, { reviewedBody: " " },
      { reviewedBody: "x".repeat(4_001) }, { expectedVersion: 0 },
      { idempotencyKey: "short" }, { sourceMessageId: "../wrong" },
    ]) {
      const h = harness();
      const result = await approveReviewedInboxReply({
        ...input, ...change,
      } as ReviewedInboxReplyInput, h.deps);
      expect(result).toMatchObject({ ok: false, code: "REVIEWED_REPLY_INPUT_INVALID" });
      expect(h.reads).toEqual([]);
      expect(h.calls).toEqual([]);
    }
  });

  it("refuses unauthenticated, crew and branch-denied approvals without enqueue", async () => {
    for (const h of [
      harness({ authorized: false }), harness({ actorRole: "CREW" }),
      harness({ branchDenied: true }),
    ]) {
      expect((await approveReviewedInboxReply(input, h.deps)).ok).toBe(false);
      expect(h.calls).toHaveLength(0);
    }
  });

  it("does not enqueue after conversation version, customer or channel drift", async () => {
    for (const changed of [
      { ...conversation, version: 4 },
      { ...conversation, customer_id: null },
      { ...conversation, channel: "VOICE" },
      { ...conversation, workspace_id: "foreign" },
      null,
    ]) {
      const h = harness({ conversation: changed });
      expect((await approveReviewedInboxReply(input, h.deps)).ok).toBe(false);
      expect(h.calls).toEqual([]);
    }
  });

  it("refuses approvals of a stale or foreign inbound customer message", async () => {
    for (const changed of [
      null, { ...source, id: "latest2" },
      { ...source, workspace_id: "another" },
      { ...source, sender_kind: "STAFF" }, { ...source, direction: "OUTBOUND" },
    ]) {
      const h = harness({ source: changed });
      expect(await approveReviewedInboxReply(input, h.deps))
        .toMatchObject({ ok: false, code: "REVIEWED_REPLY_SOURCE_STALE" });
      expect(h.calls).toEqual([]);
    }
  });

  it("distinguishes already-queued prior provider sends from newly queued messages", async () => {
    const h = harness({ outgoing: { ...delivered, deliveryState: "DELIVERED" } });
    expect(await approveReviewedInboxReply(input, h.deps)).toMatchObject({
      ok: true, value: { state: "EXISTING_REPLY", deliveryState: "DELIVERED" },
    });
  });

  it("rejects a replay of a different body, conversation, tenant, stale source or outbox identity", async () => {
    for (const changed of [
      { ...delivered, body: "Different reply" },
      { ...delivered, conversationId: "conv2" },
      { ...delivered, workspaceId: "other" },
      { ...delivered, createdAt: "2026-10-11T04:00:00Z" },
      { ...delivered, senderKind: "AI" },
    ]) {
      const h = harness({ outgoing: changed });
      expect(await approveReviewedInboxReply(input, h.deps))
        .toMatchObject({ ok: false, code: "REVIEWED_REPLY_RECEIPT_MISMATCH" });
    }
  });

  it("never treats SQL consent/optimistic conflict, DB exceptions or PII errors as a send receipt", async () => {
    for (const [code, expected] of [
      ["REPLY_CONSENT_REQUIRED", "REVIEWED_REPLY_CONSENT_REQUIRED"],
      ["VERSION_CONFLICT", "REVIEWED_REPLY_VERSION_CONFLICT"],
    ]) {
      const h = harness({ responseCode: code });
      expect(await approveReviewedInboxReply(input, h.deps))
        .toMatchObject({ ok: false, code: expected });
    }
    const h = harness({ rpcError: "private-recipient-address" });
    const result = await approveReviewedInboxReply(input, h.deps);
    expect(result).toMatchObject({ ok: false, code: "REVIEWED_REPLY_QUEUE_REJECTED" });
    expect(JSON.stringify(result)).not.toContain("private-recipient-address");
  });
});
