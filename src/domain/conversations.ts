import type { ConversationDTO, MessageDTO, MessageDeliveryState, Result } from "../contracts";

export type ConversationChannel = "WEB" | "WHATSAPP" | "EMAIL";
export type MessageDirection = "INBOUND" | "OUTBOUND" | "INTERNAL";
export type SenderKind = "CUSTOMER" | "STAFF" | "AI" | "SYSTEM";
export type InboundContentKind = "TEXT" | "MEDIA_REFERENCE" | "UNSUPPORTED";
export type ProviderInboundReceiptState = "RECEIVED" | "APPLIED" | "DUPLICATE" | "IGNORED";

export interface ConversationRecord {
  id: string;
  workspaceId: string;
  requestId?: string;
  customerId?: string;
  channel: ConversationChannel;
  providerThreadId?: string;
  assignedUserId?: string;
  handoverActive: boolean;
  handoverOwnerRevision: number;
  version: number;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  workspaceId: string;
  conversationId: string;
  direction: MessageDirection;
  senderKind: SenderKind;
  providerMessageId?: string;
  providerReceiptKey?: string;
  body?: string;
  mediaReference?: { provider: "WHATSAPP"; providerMediaId: string };
  contentKind?: InboundContentKind;
  providerAccountId?: string;
  providerOccurredAt?: string;
  senderRef?: string;
  rawProviderEventRef?: string;
  outboundIdempotencyKey?: string;
  outboxEventId?: string;
  deliveryState?: MessageDeliveryState;
  createdAt: string;
}

export interface ProviderInboundReceiptRecord {
  id: string;
  workspaceId: string;
  provider: "WHATSAPP" | "EMAIL";
  providerAccountId: string;
  providerMessageId: string;
  providerReceiptKey: string;
  senderRef: string;
  providerOccurredAt: string;
  rawProviderEventRef: string;
  contentKind: InboundContentKind;
  conversationId?: string;
  messageId?: string;
  receivedAt: string;
  processedAt?: string;
  state: ProviderInboundReceiptState;
}

export interface CustomerContactRecord {
  workspaceId: string;
  customerId: string;
  channel: "WHATSAPP" | "EMAIL" | "SMS" | "PHONE";
  value: string;
  verified: boolean;
  canReceiveMessages: boolean;
}

export interface ActiveRequestReference {
  id: string;
  workspaceId: string;
  customerId: string;
  status: string;
}

export interface ConversationOutboxRecord {
  id: string;
  workspaceId: string;
  topic: "conversation.reply";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
}

export function providerThreadId(provider: "WHATSAPP", providerAccountId: string, senderRef: string): string {
  return `${provider}:${providerAccountId.trim()}:${senderRef.trim()}`;
}

export function conversationToDTO(record: ConversationRecord): ConversationDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    requestId: record.requestId,
    customerId: record.customerId,
    channel: record.channel,
    assignedUserId: record.assignedUserId,
    handoverActive: record.handoverActive,
    version: record.version,
    lastMessageAt: record.lastMessageAt,
  };
}

export function messageToDTO(record: MessageRecord): MessageDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    conversationId: record.conversationId,
    direction: record.direction,
    senderKind: record.senderKind,
    providerMessageId: record.providerMessageId,
    body: record.body,
    mediaReference: record.mediaReference,
    deliveryState: record.deliveryState,
    createdAt: record.createdAt,
  };
}

export function validateIsoTimestamp(value: string, code: string, message: string): Result<true> {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return { ok: false, code, message };
  return { ok: true, value: true };
}

export function nonblank(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function nextConversationVersion(record: ConversationRecord, at: string): ConversationRecord {
  return { ...record, version: record.version + 1, updatedAt: at, lastMessageAt: at };
}
