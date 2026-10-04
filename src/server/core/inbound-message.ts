import type { ActorContext, CommandMeta, Result } from "../../contracts";
import { conversationToDTO, messageToDTO, nextConversationVersion, nonblank, providerThreadId, validateIsoTimestamp, type ConversationRecord, type MessageRecord, type ProviderInboundReceiptRecord } from "../../domain/conversations";
import { requireActiveStaffContext, requireRole } from "./auth";
import type { ConversationHandoverInput, ConversationReplyInput, ConversationReplyOutcome, InboundMessageApplicationOutcome, InboundMessageEvent, WorkspaceSnapshot, WorkspaceSnapshotQuery } from "./facade";
import { ensureConversationWorkspace, failClosed, type ConversationRepository, type ConversationTransaction } from "./conversation-repository";

export interface ConversationFacadeDependencies { conversationRepository: ConversationRepository; }

function staffOwnerDispatcher(ctx: ActorContext): Result<true> {
  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

function validInbound(event: InboundMessageEvent): Result<true> {
  if (!nonblank(event.receiptKey)) return failClosed("INBOUND_RECEIPT_REQUIRED", "Inbound receipt key is required.");
  if (!nonblank(event.providerAccountId)) return failClosed("INBOUND_PROVIDER_ACCOUNT_REQUIRED", "Provider account is required.");
  if (!nonblank(event.providerMessageId)) return failClosed("INBOUND_PROVIDER_MESSAGE_REQUIRED", "Provider message identifier is required.");
  if (!nonblank(event.senderRef)) return failClosed("INBOUND_SENDER_REQUIRED", "Sender reference is required.");
  if (!nonblank(event.rawProviderEventRef)) return failClosed("INBOUND_RAW_REF_REQUIRED", "Raw provider event reference is required.");
  const time = validateIsoTimestamp(event.occurredAt, "INBOUND_OCCURRED_AT_INVALID", "Inbound occurredAt must be a valid timestamp.");
  if (time.ok === false) return time;
  if (event.contentKind === "UNSUPPORTED") return failClosed("INBOUND_CONTENT_UNSUPPORTED", "Inbound content kind is not business-processable.");
  if (event.contentKind === "TEXT" && !nonblank(event.text)) return failClosed("INBOUND_TEXT_REQUIRED", "Text inbound message requires nonblank text.");
  if (event.contentKind === "MEDIA_REFERENCE" && !event.media?.providerMediaId) return failClosed("INBOUND_MEDIA_REF_REQUIRED", "Media inbound message requires a provider media reference.");
  return { ok: true, value: true };
}

async function loadDuplicateOutcome(tx: ConversationTransaction, receipt: ProviderInboundReceiptRecord): Promise<Result<InboundMessageApplicationOutcome>> {
  if (!receipt.conversationId) return failClosed("INBOUND_DUPLICATE_RECEIPT_INCOMPLETE", "Duplicate receipt has no conversation reference.");
  const conversation = await tx.findConversationById(receipt.workspaceId, receipt.conversationId);
  if (conversation.ok === false) return conversation;
  return { ok: true, value: { state: "DUPLICATE", conversation: conversationToDTO(conversation.value) } };
}

async function resolveConversation(tx: ConversationTransaction, event: InboundMessageEvent): Promise<Result<ConversationRecord>> {
  const threadId = providerThreadId(event.channel, event.providerAccountId, event.senderRef);
  const existing = await tx.findConversationByProviderThread(event.workspaceId, event.channel, threadId);
  if (existing) return ensureConversationWorkspace(existing, event.workspaceId);
  const contact = await tx.findCustomerByContact(event.workspaceId, "WHATSAPP", event.senderRef);
  const request = contact ? await tx.findUnambiguousActiveRequest(event.workspaceId, contact.customerId) : undefined;
  return tx.insertConversation({
    id: tx.nextConversationId(), workspaceId: event.workspaceId, requestId: request?.id, customerId: contact?.customerId,
    channel: event.channel, providerThreadId: threadId, handoverActive: false, handoverOwnerRevision: 0,
    version: 1, createdAt: event.occurredAt, updatedAt: event.occurredAt,
  });
}

export function createConversationFacadeMethods(deps: ConversationFacadeDependencies) {
  return {
    async applyInboundMessage(event: InboundMessageEvent): Promise<Result<InboundMessageApplicationOutcome>> {
      const valid = validInbound(event);
      if (valid.ok === false) return valid;
      return deps.conversationRepository.transaction(async (tx) => {
        const duplicate = await tx.findReceiptByIdentity(event.workspaceId, event.receiptKey, event.providerMessageId);
        if (duplicate) return loadDuplicateOutcome(tx, duplicate);
        const receipt: ProviderInboundReceiptRecord = {
          id: tx.nextReceiptId(), workspaceId: event.workspaceId, provider: event.channel, providerAccountId: event.providerAccountId,
          providerMessageId: event.providerMessageId, providerReceiptKey: event.receiptKey, rawProviderEventRef: event.rawProviderEventRef,
          contentKind: event.contentKind, receivedAt: event.occurredAt, state: "RECEIVED",
        };
        const savedReceipt = await tx.insertInboundReceipt(receipt);
        if (savedReceipt.ok === false) return savedReceipt;
        const conversation = await resolveConversation(tx, event);
        if (conversation.ok === false) return conversation;
        const message: MessageRecord = {
          id: tx.nextMessageId(), workspaceId: event.workspaceId, conversationId: conversation.value.id, direction: "INBOUND", senderKind: "CUSTOMER",
          providerMessageId: event.providerMessageId, providerReceiptKey: event.receiptKey,
          body: event.contentKind === "TEXT" ? event.text?.trim() : undefined,
          mediaReference: event.contentKind === "MEDIA_REFERENCE" ? event.media : undefined,
          contentKind: event.contentKind, providerAccountId: event.providerAccountId, senderRef: event.senderRef,
          rawProviderEventRef: event.rawProviderEventRef, deliveryState: "DELIVERED", createdAt: event.occurredAt,
        };
        const insertedMessage = await tx.insertMessage(message);
        if (insertedMessage.ok === false) return insertedMessage;
        const bumped = await tx.updateConversation(nextConversationVersion(conversation.value, event.occurredAt));
        if (bumped.ok === false) return bumped;
        const applied = await tx.markInboundReceiptApplied(savedReceipt.value.id, bumped.value.id, insertedMessage.value.id, event.occurredAt);
        if (applied.ok === false) return applied;
        return { ok: true, value: { state: "APPLIED", conversation: conversationToDTO(bumped.value), message: messageToDTO(insertedMessage.value) } };
      });
    },

    async setConversationHandover(ctx: ActorContext, id: string, input: ConversationHandoverInput, meta: CommandMeta) {
      const staff = staffOwnerDispatcher(ctx);
      if (staff.ok === false) return staff;
      if (meta.expectedVersion === undefined) return failClosed("EXPECTED_VERSION_REQUIRED", "Conversation handover requires an expected version.");
      return deps.conversationRepository.transaction(async (tx) => {
        const current = await tx.findConversationById(ctx.workspaceId, id);
        if (current.ok === false) return current;
        const scoped = ensureConversationWorkspace(current.value, ctx.workspaceId);
        if (scoped.ok === false) return scoped;
        if (scoped.value.version !== meta.expectedVersion) return failClosed("VERSION_CONFLICT", "Conversation version changed before this command was applied.");
        let assignedUserId: string | undefined;
        if (input.active) {
          assignedUserId = input.assignedUserId ?? ctx.userId;
          if (!assignedUserId) return failClosed("HANDOVER_ASSIGNEE_REQUIRED", "Active handover requires an assignee.");
          if (!(await tx.isAssignableStaff(ctx.workspaceId, assignedUserId))) return failClosed("HANDOVER_ASSIGNEE_FORBIDDEN", "Assigned user is not authorized for handover ownership.");
        }
        const stateChanged = scoped.value.handoverActive !== input.active || scoped.value.assignedUserId !== assignedUserId;
        if (!stateChanged) return { ok: true, value: conversationToDTO(scoped.value) };
        const updated: ConversationRecord = { ...scoped.value, handoverActive: input.active, assignedUserId: input.active ? assignedUserId : undefined, handoverOwnerRevision: scoped.value.handoverOwnerRevision + 1, version: scoped.value.version + 1, updatedAt: meta.now };
        const saved = await tx.updateConversation(updated);
        if (saved.ok === false) return saved;
        return { ok: true, value: conversationToDTO(saved.value) };
      });
    },

    async enqueueConversationReply(ctx: ActorContext, id: string, input: ConversationReplyInput, meta: CommandMeta): Promise<Result<ConversationReplyOutcome>> {
      const staff = staffOwnerDispatcher(ctx);
      if (staff.ok === false) return staff;
      if (meta.expectedVersion === undefined) return failClosed("EXPECTED_VERSION_REQUIRED", "Conversation reply requires an expected version.");
      const body = input.body.trim();
      if (!body || body.length > 4000) return failClosed("REPLY_BODY_INVALID", "Reply body must be nonblank and at most 4000 characters.");
      return deps.conversationRepository.transaction(async (tx) => {
        const duplicate = await tx.findOutboundReplyByIdempotency(ctx.workspaceId, meta.idempotencyKey);
        if (duplicate) return { ok: true, value: { message: messageToDTO(duplicate.message), outboxEventId: duplicate.outboxEventId } };
        const current = await tx.findConversationById(ctx.workspaceId, id);
        if (current.ok === false) return current;
        const scoped = ensureConversationWorkspace(current.value, ctx.workspaceId);
        if (scoped.ok === false) return scoped;
        if (scoped.value.version !== meta.expectedVersion) return failClosed("VERSION_CONFLICT", "Conversation version changed before this command was applied.");
        if (scoped.value.channel !== input.channel) return failClosed("REPLY_CHANNEL_MISMATCH", "Reply channel must match the conversation channel.");
        if (!scoped.value.customerId) return failClosed("REPLY_CUSTOMER_REQUIRED", "Conversation must be attached to a customer before staff reply.");
        const recipient = await tx.getReplyRecipient(ctx.workspaceId, scoped.value.customerId, input.channel);
        if (!recipient) return failClosed("REPLY_RECIPIENT_NOT_FOUND", "No authoritative recipient is available for this conversation.");
        if (recipient.consent !== "GRANTED") return failClosed("REPLY_CONSENT_REQUIRED", "Customer consent does not permit this reply.");
        const messageId = tx.nextMessageId();
        const outboxEventId = tx.nextOutboxEventId();
        const message: MessageRecord = { id: messageId, workspaceId: ctx.workspaceId, conversationId: scoped.value.id, direction: "OUTBOUND", senderKind: "STAFF", body, outboundIdempotencyKey: meta.idempotencyKey, outboxEventId, deliveryState: "QUEUED", createdAt: meta.now };
        const inserted = await tx.insertMessage(message);
        if (inserted.ok === false) return inserted;
        const outbox = await tx.enqueueOutbox({ id: outboxEventId, workspaceId: ctx.workspaceId, topic: "conversation.reply", idempotencyKey: `conversation.reply:${ctx.workspaceId}:${meta.idempotencyKey}`, createdAt: meta.now, payload: { conversationId: scoped.value.id, messageId, channel: input.channel, recipient: recipient.address } });
        if (outbox.ok === false) return outbox;
        const savedConversation = await tx.updateConversation(nextConversationVersion(scoped.value, meta.now));
        if (savedConversation.ok === false) return savedConversation;
        return { ok: true, value: { message: messageToDTO(inserted.value), outboxEventId: outbox.value.id } };
      });
    },

    async readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery): Promise<Result<WorkspaceSnapshot>> {
      if (ctx.role === "VISITOR" || ctx.role === "CREW") return failClosed("FORBIDDEN", "Role is not authorized for workspace inbox snapshots.");
      return deps.conversationRepository.transaction(async (tx) => {
        let customerId = query.customerId;
        if (ctx.role === "CUSTOMER") {
          if (!ctx.userId) return failClosed("CUSTOMER_AUTH_REQUIRED", "Customer identity is required.");
          const resolved = await tx.resolveCustomerIdForUser(ctx.workspaceId, ctx.userId);
          if (!resolved) return failClosed("CUSTOMER_SCOPE_REQUIRED", "Customer is not attached to this workspace.");
          if (customerId && customerId !== resolved) return failClosed("CUSTOMER_SCOPE_REQUIRED", "Customer cannot access another customer's snapshot.");
          customerId = resolved;
        } else {
          const staff = staffOwnerDispatcher(ctx);
          if (staff.ok === false) return staff;
        }
        const snapshot = await tx.readSnapshot({ workspaceId: ctx.workspaceId, customerId, requestId: query.requestId, conversationId: query.conversationId });
        if (snapshot.ok === false) return snapshot;
        const allowedConversationIds = new Set(snapshot.value.conversations.map((conversation) => conversation.id));
        return { ok: true, value: { requests: snapshot.value.requests, quotes: snapshot.value.quotes, visits: snapshot.value.visits, invoices: snapshot.value.invoices, conversations: snapshot.value.conversations.map(conversationToDTO), messages: snapshot.value.messages.filter((message) => allowedConversationIds.has(message.conversationId)).map(messageToDTO) } };
      });
    },
  };
}
