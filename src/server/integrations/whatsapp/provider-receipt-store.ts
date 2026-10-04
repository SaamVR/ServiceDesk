import type { DurableWhatsAppInboxRecord, DurableWhatsAppInboxStore, DurableWhatsAppInboxPersistenceResult } from "./inbox-persistence";

export interface WhatsAppProviderInboundReceiptRow {
  receiptKey: string;
  workspaceId: string;
  provider: "WHATSAPP";
  providerAccountId: string;
  providerMessageId: string;
  senderRef: string;
  providerTimestamp: string;
  contentKind: DurableWhatsAppInboxRecord["contentKind"];
  text?: string;
  mediaProvider?: "WHATSAPP";
  mediaProviderMediaId?: string;
  rawProviderEventRef: string;
  rawPayloadIncluded: false;
  aiAuthoritative: false;
}

export interface WhatsAppProviderInboundReceiptGateway {
  insertReceipt(row: WhatsAppProviderInboundReceiptRow): Promise<DurableWhatsAppInboxPersistenceResult>;
}

function nonblank(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function toWhatsAppProviderInboundReceiptRow(record: DurableWhatsAppInboxRecord): WhatsAppProviderInboundReceiptRow {
  if (record.provider !== "WHATSAPP" || record.channel !== "WHATSAPP") {
    throw new Error("WHATSAPP_RECEIPT_IDENTITY_MISMATCH: provider/channel must be WHATSAPP.");
  }
  if (!nonblank(record.receiptKey) || !nonblank(record.workspaceId) || !nonblank(record.providerAccountId) || !nonblank(record.providerMessageId) || !nonblank(record.senderRef)) {
    throw new Error("WHATSAPP_RECEIPT_IDENTITY_INVALID: required receipt identity fields are missing.");
  }
  if (!nonblank(record.rawProviderEventRef)) {
    throw new Error("WHATSAPP_RECEIPT_RAW_REF_MISSING: raw provider event reference is required.");
  }
  if (record.rawPayloadIncluded !== false || record.aiAuthoritative !== false) {
    throw new Error("WHATSAPP_RECEIPT_RAW_PAYLOAD_FORBIDDEN: raw provider body and AI authority flags must not be persisted.");
  }

  return {
    receiptKey: record.receiptKey,
    workspaceId: record.workspaceId,
    provider: "WHATSAPP",
    providerAccountId: record.providerAccountId,
    providerMessageId: record.providerMessageId,
    senderRef: record.senderRef,
    providerTimestamp: record.providerTimestamp,
    contentKind: record.contentKind,
    text: record.text,
    mediaProvider: record.media?.provider,
    mediaProviderMediaId: record.media?.providerMediaId,
    rawProviderEventRef: record.rawProviderEventRef,
    rawPayloadIncluded: false,
    aiAuthoritative: false,
  };
}

export function createWhatsAppProviderReceiptStore(gateway: WhatsAppProviderInboundReceiptGateway): DurableWhatsAppInboxStore {
  return {
    async persist(record: DurableWhatsAppInboxRecord): Promise<DurableWhatsAppInboxPersistenceResult> {
      return gateway.insertReceipt(toWhatsAppProviderInboundReceiptRow(record));
    },
  };
}
