import assert from "node:assert/strict";
import type { ActorContext, Result } from "../../src/contracts";
import type { InboundMessageEvent } from "../../src/server/core/facade";
import { createServerCommandEntrypoints } from "../../src/server/core/server-entrypoints";
import type { ConversationRepository, ConversationTransaction, ConversationSnapshotRows, ReplyRecipient } from "../../src/server/core/conversation-repository";
import type { ActiveRequestReference, ConversationOutboxRecord, ConversationRecord, CustomerContactRecord, MessageRecord, ProviderInboundReceiptRecord } from "../../src/domain/conversations";

const now = "2026-10-04T06:00:00.000Z";
const owner: ActorContext = { workspaceId: "ws_1", userId: "owner_1", role: "OWNER" };
const dispatcher: ActorContext = { workspaceId: "ws_1", userId: "dispatcher_1", role: "DISPATCHER" };
const customer: ActorContext = { workspaceId: "ws_1", userId: "auth_customer_1", role: "CUSTOMER" };
const otherCustomer: ActorContext = { workspaceId: "ws_1", userId: "auth_customer_2", role: "CUSTOMER" };
const visitor: ActorContext = { workspaceId: "ws_1", visitorSessionId: "v1", role: "VISITOR" };

function inbound(overrides: Partial<InboundMessageEvent> = {}): InboundMessageEvent {
  return { receiptKey: "receipt_1", workspaceId: "ws_1", channel: "WHATSAPP", providerAccountId: "wa_account_1", providerMessageId: "wamid_1", senderRef: "+15550000001", occurredAt: now, contentKind: "TEXT", text: "I need cleaning help", rawProviderEventRef: "provider-events/evt_1.json", ...overrides };
}

class MemoryRepo implements ConversationRepository {
  conversations: ConversationRecord[] = [];
  messages: MessageRecord[] = [];
  receipts: ProviderInboundReceiptRecord[] = [];
  outbox: ConversationOutboxRecord[] = [];
  contacts: CustomerContactRecord[] = [{ workspaceId: "ws_1", customerId: "cust_1", channel: "WHATSAPP", value: "+15550000001", verified: true, canReceiveMessages: true }];
  customerUsers = new Map<string, string>([["auth_customer_1", "cust_1"], ["auth_customer_2", "cust_2"]]);
  activeRequests: ActiveRequestReference[] = [{ id: "req_1", workspaceId: "ws_1", customerId: "cust_1", status: "READY" }];
  assignable = new Set(["owner_1", "dispatcher_1"]);
  consent = new Map<string, "GRANTED" | "REVOKED" | "UNKNOWN">([["cust_1:WHATSAPP", "GRANTED"]]);
  failNextOutbox = false;
  ids = { conversation: 1, message: 1, receipt: 1, outbox: 1 };

  async transaction<T>(run: (tx: ConversationTransaction) => Promise<Result<T>>): Promise<Result<T>> {
    const snapshot = {
      conversations: this.conversations.map((x) => ({ ...x })), messages: this.messages.map((x) => ({ ...x })), receipts: this.receipts.map((x) => ({ ...x })),
      outbox: this.outbox.map((x) => ({ ...x, payload: { ...x.payload } })), ids: { ...this.ids },
    };
    const result = await run(this.tx());
    if (!result.ok) {
      this.conversations = snapshot.conversations; this.messages = snapshot.messages; this.receipts = snapshot.receipts; this.outbox = snapshot.outbox; this.ids = snapshot.ids;
    }
    return result;
  }

  private tx(): ConversationTransaction {
    return {
      nextConversationId: () => `conv_${this.ids.conversation++}`,
      nextMessageId: () => `msg_${this.ids.message++}`,
      nextReceiptId: () => `receipt_row_${this.ids.receipt++}`,
      nextOutboxEventId: () => `outbox_${this.ids.outbox++}`,
      findReceiptByIdentity: async (workspaceId, receiptKey, messageId) => this.receipts.find((r) => r.workspaceId === workspaceId && (r.providerReceiptKey === receiptKey || r.providerMessageId === messageId)),
      insertInboundReceipt: async (receipt) => { this.receipts.push(receipt); return { ok: true, value: receipt }; },
      markInboundReceiptApplied: async (receiptId, conversationId, messageId, processedAt) => {
        const receipt = this.receipts.find((r) => r.id === receiptId);
        if (!receipt) return { ok: false, code: "RECEIPT_NOT_FOUND", message: "Receipt missing." };
        Object.assign(receipt, { conversationId, messageId, processedAt, state: "APPLIED" });
        return { ok: true, value: receipt };
      },
      findConversationByProviderThread: async (workspaceId, channel, threadId) => this.conversations.find((c) => c.workspaceId === workspaceId && c.channel === channel && c.providerThreadId === threadId),
      findConversationById: async (workspaceId, conversationId) => {
        const c = this.conversations.find((item) => item.workspaceId === workspaceId && item.id === conversationId);
        return c ? { ok: true, value: c } : { ok: false, code: "CONVERSATION_NOT_FOUND", message: "Conversation was not found in this workspace." };
      },
      insertConversation: async (conversation) => { this.conversations.push(conversation); return { ok: true, value: conversation }; },
      updateConversation: async (conversation) => {
        const index = this.conversations.findIndex((item) => item.workspaceId === conversation.workspaceId && item.id === conversation.id);
        if (index < 0) return { ok: false, code: "CONVERSATION_NOT_FOUND", message: "Conversation was not found in this workspace." };
        this.conversations[index] = conversation;
        return { ok: true, value: conversation };
      },
      findCustomerByContact: async (workspaceId, channel, value) => this.contacts.find((c) => c.workspaceId === workspaceId && c.channel === channel && c.value === value && c.verified),
      findUnambiguousActiveRequest: async (workspaceId, customerId) => {
        const matches = this.activeRequests.filter((r) => r.workspaceId === workspaceId && r.customerId === customerId && !["CLOSED", "LOST"].includes(r.status));
        return matches.length === 1 ? matches[0] : undefined;
      },
      isAssignableStaff: async (workspaceId, userId) => workspaceId === "ws_1" && this.assignable.has(userId),
      resolveCustomerIdForUser: async (workspaceId, userId) => workspaceId === "ws_1" ? this.customerUsers.get(userId) : undefined,
      getReplyRecipient: async (workspaceId, customerId, channel): Promise<ReplyRecipient | undefined> => {
        const contact = this.contacts.find((c) => c.workspaceId === workspaceId && c.customerId === customerId && c.channel === channel && c.canReceiveMessages);
        if (!contact) return undefined;
        return { channel, address: contact.value, consent: this.consent.get(`${customerId}:${channel}`) ?? "UNKNOWN" };
      },
      insertMessage: async (message) => { this.messages.push(message); return { ok: true, value: message }; },
      findOutboundReplyByIdempotency: async (workspaceId, idempotencyKey) => {
        const msg = this.messages.find((m) => m.workspaceId === workspaceId && m.outboundIdempotencyKey === idempotencyKey);
        return msg?.outboxEventId ? { message: msg, outboxEventId: msg.outboxEventId } : undefined;
      },
      enqueueOutbox: async (event) => {
        if (this.failNextOutbox) { this.failNextOutbox = false; return { ok: false, code: "OUTBOX_INSERT_FAILED", message: "Injected outbox failure." }; }
        this.outbox.push(event); return { ok: true, value: event };
      },
      readSnapshot: async (input): Promise<Result<ConversationSnapshotRows>> => {
        let conversations = this.conversations.filter((c) => c.workspaceId === input.workspaceId);
        if (input.customerId) conversations = conversations.filter((c) => c.customerId === input.customerId);
        if (input.requestId) conversations = conversations.filter((c) => c.requestId === input.requestId);
        if (input.conversationId) conversations = conversations.filter((c) => c.id === input.conversationId);
        const ids = new Set(conversations.map((c) => c.id));
        return { ok: true, value: { requests: [], quotes: [], visits: [], invoices: [], conversations, messages: this.messages.filter((m) => ids.has(m.conversationId)) } };
      },
    };
  }
}

async function main() {
  const repo = new MemoryRepo();
  const commands = createServerCommandEntrypoints({ conversationRepository: repo } as any);

  const first = await commands.applyInboundMessageCommand(inbound());
  if (!first.ok) throw new Error(first.message); assert.equal(first.ok, true);
  assert.equal(first.value.state, "APPLIED");
  assert.equal(first.value.conversation.customerId, "cust_1");
  assert.equal(first.value.conversation.requestId, "req_1");
  assert.equal(repo.messages.length, 1);
  const versionAfterFirst = first.value.conversation.version;

  const dupe = await commands.applyInboundMessageCommand(inbound());
  if (!dupe.ok) throw new Error(dupe.message); assert.equal(dupe.ok, true);
  assert.equal(dupe.value.state, "DUPLICATE");
  assert.equal(repo.messages.length, 1);
  assert.equal(repo.conversations[0].version, versionAfterFirst);

  const unknown = await commands.applyInboundMessageCommand(inbound({ receiptKey: "receipt_unknown", providerMessageId: "wamid_unknown", senderRef: "+15559999999" }));
  if (!unknown.ok) throw new Error(unknown.message); assert.equal(unknown.ok, true);
  assert.equal(unknown.value.conversation.customerId, undefined);

  const convId = first.value.conversation.id;
  const handover = await commands.setConversationHandoverCommand(owner, convId, { active: true }, { idempotencyKey: "handover-1", now, expectedVersion: repo.conversations[0].version });
  if (!handover.ok) throw new Error(handover.message); assert.equal(handover.ok, true);
  assert.equal(handover.value.handoverActive, true);
  assert.equal(handover.value.assignedUserId, "owner_1");

  const stale = await commands.setConversationHandoverCommand(owner, convId, { active: false }, { idempotencyKey: "handover-stale", now, expectedVersion: 1 });
  assert.equal(stale.ok, false); if (stale.ok) throw new Error("expected stale failure");
  assert.equal(stale.code, "VERSION_CONFLICT");

  const cross = await commands.setConversationHandoverCommand({ workspaceId: "ws_2", userId: "owner_2", role: "OWNER" }, convId, { active: false }, { idempotencyKey: "handover-x", now, expectedVersion: repo.conversations[0].version });
  assert.equal(cross.ok, false);

  const reply = await commands.enqueueConversationReplyCommand(dispatcher, convId, { body: "We can help today.", channel: "WHATSAPP" }, { idempotencyKey: "reply-1", now, expectedVersion: repo.conversations[0].version });
  if (!reply.ok) throw new Error(reply.message); assert.equal(reply.ok, true);
  assert.equal(reply.value.message.deliveryState, "QUEUED");
  assert.equal(repo.outbox.length, 1);

  const replyDupe = await commands.enqueueConversationReplyCommand(dispatcher, convId, { body: "We can help today.", channel: "WHATSAPP" }, { idempotencyKey: "reply-1", now, expectedVersion: repo.conversations[0].version });
  assert.equal(replyDupe.ok, true);
  assert.equal(repo.outbox.length, 1);
  assert.equal(repo.messages.filter((m) => m.direction === "OUTBOUND").length, 1);

  repo.consent.set("cust_1:WHATSAPP", "REVOKED");
  const optedOut = await commands.enqueueConversationReplyCommand(dispatcher, convId, { body: "Blocked", channel: "WHATSAPP" }, { idempotencyKey: "reply-optout", now, expectedVersion: repo.conversations[0].version });
  assert.equal(optedOut.ok, false); if (optedOut.ok) throw new Error("expected opt-out failure");
  assert.equal(optedOut.code, "REPLY_CONSENT_REQUIRED");
  repo.consent.set("cust_1:WHATSAPP", "GRANTED");

  const beforeMessages = repo.messages.length;
  const beforeOutbox = repo.outbox.length;
  repo.failNextOutbox = true;
  const rollback = await commands.enqueueConversationReplyCommand(dispatcher, convId, { body: "Rollback", channel: "WHATSAPP" }, { idempotencyKey: "reply-rollback", now, expectedVersion: repo.conversations[0].version });
  assert.equal(rollback.ok, false);
  assert.equal(repo.messages.length, beforeMessages);
  assert.equal(repo.outbox.length, beforeOutbox);

  const staffSnapshot = await commands.readWorkspaceSnapshotCommand(owner, { conversationId: convId });
  if (!staffSnapshot.ok) throw new Error(staffSnapshot.message); assert.equal(staffSnapshot.ok, true);
  assert.equal(staffSnapshot.value.conversations.length, 1);
  assert.ok(staffSnapshot.value.messages.length >= 2);

  const customerSnapshot = await commands.readWorkspaceSnapshotCommand(customer, {});
  if (!customerSnapshot.ok) throw new Error(customerSnapshot.message); assert.equal(customerSnapshot.ok, true);
  assert.equal(customerSnapshot.value.conversations.every((c) => c.customerId === "cust_1"), true);

  const otherCustomerSnapshot = await commands.readWorkspaceSnapshotCommand(otherCustomer, {});
  if (!otherCustomerSnapshot.ok) throw new Error(otherCustomerSnapshot.message); assert.equal(otherCustomerSnapshot.ok, true);
  assert.equal(otherCustomerSnapshot.value.conversations.length, 0);

  const visitorSnapshot = await commands.readWorkspaceSnapshotCommand(visitor, {});
  assert.equal(visitorSnapshot.ok, false); if (visitorSnapshot.ok) throw new Error("expected visitor denial");
  assert.equal(visitorSnapshot.code, "FORBIDDEN");

  const deactivated = await commands.setConversationHandoverCommand(owner, convId, { active: false }, { idempotencyKey: "handover-off", now, expectedVersion: repo.conversations[0].version });
  if (!deactivated.ok) throw new Error(deactivated.message); assert.equal(deactivated.ok, true);
  assert.equal(deactivated.value.handoverActive, false);

  console.log("runtime-outage e05 inbox handover harness PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
