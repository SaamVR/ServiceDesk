import type { InvoiceDTO, QuoteDTO, RequestDTO, Result, VisitDTO } from "../../contracts";
import type { ActiveRequestReference, ConversationOutboxRecord, ConversationRecord, CustomerContactRecord, MessageRecord, ProviderInboundReceiptRecord } from "../../domain/conversations";

export interface ReplyRecipient {
  channel: "WHATSAPP" | "EMAIL";
  address: string;
  consent: "GRANTED" | "REVOKED" | "UNKNOWN";
}

export interface ConversationSnapshotRows {
  requests: RequestDTO[];
  quotes: QuoteDTO[];
  visits: VisitDTO[];
  invoices: InvoiceDTO[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
}

export interface ConversationTransaction {
  nextConversationId(): string;
  nextMessageId(): string;
  nextReceiptId(): string;
  nextOutboxEventId(): string;
  findReceiptByIdentity(workspaceId: string, providerReceiptKey: string, providerMessageId: string): Promise<ProviderInboundReceiptRecord | undefined>;
  insertInboundReceipt(receipt: ProviderInboundReceiptRecord): Promise<Result<ProviderInboundReceiptRecord>>;
  markInboundReceiptApplied(receiptId: string, conversationId: string, messageId: string, processedAt: string): Promise<Result<ProviderInboundReceiptRecord>>;
  findConversationByProviderThread(workspaceId: string, channel: ConversationRecord["channel"], providerThreadId: string): Promise<ConversationRecord | undefined>;
  findConversationById(workspaceId: string, conversationId: string): Promise<Result<ConversationRecord>>;
  insertConversation(conversation: ConversationRecord): Promise<Result<ConversationRecord>>;
  updateConversation(conversation: ConversationRecord): Promise<Result<ConversationRecord>>;
  findCustomerByContact(workspaceId: string, channel: "WHATSAPP" | "EMAIL" | "PHONE", value: string): Promise<CustomerContactRecord | undefined>;
  findUnambiguousActiveRequest(workspaceId: string, customerId: string): Promise<ActiveRequestReference | undefined>;
  isAssignableStaff(workspaceId: string, userId: string): Promise<boolean>;
  resolveCustomerIdForUser(workspaceId: string, userId: string): Promise<string | undefined>;
  getReplyRecipient(workspaceId: string, customerId: string, channel: "WHATSAPP" | "EMAIL"): Promise<ReplyRecipient | undefined>;
  insertMessage(message: MessageRecord): Promise<Result<MessageRecord>>;
  findOutboundReplyByIdempotency(workspaceId: string, idempotencyKey: string): Promise<{ message: MessageRecord; outboxEventId: string } | undefined>;
  enqueueOutbox(event: ConversationOutboxRecord): Promise<Result<ConversationOutboxRecord>>;
  readSnapshot(input: { workspaceId: string; customerId?: string; requestId?: string; conversationId?: string }): Promise<Result<ConversationSnapshotRows>>;
}

export interface ConversationRepository {
  transaction<T>(run: (tx: ConversationTransaction) => Promise<Result<T>>): Promise<Result<T>>;
}

export function failClosed<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

export function ensureConversationWorkspace(conversation: ConversationRecord, workspaceId: string): Result<ConversationRecord> {
  if (conversation.workspaceId !== workspaceId) return failClosed("CONVERSATION_SCOPE_MISMATCH", "Conversation does not belong to this workspace.");
  return { ok: true, value: conversation };
}
