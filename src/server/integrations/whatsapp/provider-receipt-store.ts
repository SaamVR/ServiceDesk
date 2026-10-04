import type { DurableWhatsAppInboxRecord, DurableWhatsAppInboxStore, DurableWhatsAppInboxPersistenceResult } from "./inbox-persistence";
import { normalizeProviderTimestampToIso } from "./timestamp-normalization";

export interface WhatsAppProviderInboundReceiptRow {
  receiptKey: string;
  workspaceId: string;
  provider: "WHATSAPP";
  providerAccountId: string;
  providerMessageId: string;
  senderRef: string;
  providerOccurredAt: string;
  rawProviderEventRef: string;
  contentKind: DurableWhatsAppInboxRecord["contentKind"];
}

export interface SupabaseProviderInboundReceiptRow {
  receipt_key: string;
  workspace_id: string;
  provider: "WHATSAPP";
  provider_account_id: string;
  provider_message_id: string;
  sender_ref: string;
  provider_occurred_at: string;
  raw_provider_event_ref: string;
  content_kind: DurableWhatsAppInboxRecord["contentKind"];
}

export type SupabaseProviderInboundReceiptInsert = SupabaseProviderInboundReceiptRow;

export interface SupabasePostgrestError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export interface SupabaseMaybeSingleResult<T> {
  data: T | null;
  error: SupabasePostgrestError | null;
}

export interface SupabaseProviderInboundReceiptQuery<T> {
  eq(column: string, value: string): SupabaseProviderInboundReceiptQuery<T>;
  maybeSingle(): Promise<SupabaseMaybeSingleResult<T>>;
}

export interface SupabaseProviderInboundReceiptInsertBuilder<T> {
  select(columns: string): {
    maybeSingle(): Promise<SupabaseMaybeSingleResult<T>>;
  };
}

export interface SupabaseProviderInboundReceiptTable<T> {
  insert(row: SupabaseProviderInboundReceiptInsert): SupabaseProviderInboundReceiptInsertBuilder<T>;
  select(columns: string): SupabaseProviderInboundReceiptQuery<T>;
}

export interface SupabaseProviderInboundReceiptClient {
  from(tableName: string): SupabaseProviderInboundReceiptTable<SupabaseProviderInboundReceiptRow>;
}

export interface SupabaseWhatsAppProviderReceiptGatewayOptions {
  tableName?: string;
}

export interface WhatsAppProviderInboundReceiptGateway {
  insertReceipt(row: WhatsAppProviderInboundReceiptRow): Promise<DurableWhatsAppInboxPersistenceResult>;
}

const receiptColumns = [
  "receipt_key",
  "workspace_id",
  "provider",
  "provider_account_id",
  "provider_message_id",
  "sender_ref",
  "provider_occurred_at",
  "raw_provider_event_ref",
  "content_kind",
].join(",");

function nonblank(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isDuplicateError(error: SupabasePostgrestError | null): boolean {
  const code = error?.code?.toUpperCase();
  const message = error?.message?.toLowerCase() ?? "";
  return code === "23505" || message.includes("duplicate") || message.includes("unique");
}

function toDbRow(row: WhatsAppProviderInboundReceiptRow): SupabaseProviderInboundReceiptInsert {
  return {
    receipt_key: row.receiptKey,
    workspace_id: row.workspaceId,
    provider: "WHATSAPP",
    provider_account_id: row.providerAccountId,
    provider_message_id: row.providerMessageId,
    sender_ref: row.senderRef,
    provider_occurred_at: row.providerOccurredAt,
    raw_provider_event_ref: row.rawProviderEventRef,
    content_kind: row.contentKind,
  };
}

function fromDbRow(row: SupabaseProviderInboundReceiptRow): WhatsAppProviderInboundReceiptRow {
  return {
    receiptKey: row.receipt_key,
    workspaceId: row.workspace_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    providerMessageId: row.provider_message_id,
    senderRef: row.sender_ref,
    providerOccurredAt: row.provider_occurred_at,
    rawProviderEventRef: row.raw_provider_event_ref,
    contentKind: row.content_kind,
  };
}

function assertSameIdentity(expected: WhatsAppProviderInboundReceiptRow, actual: WhatsAppProviderInboundReceiptRow): void {
  const mismatches: string[] = [];
  if (actual.receiptKey !== expected.receiptKey) mismatches.push("receiptKey");
  if (actual.workspaceId !== expected.workspaceId) mismatches.push("workspaceId");
  if (actual.provider !== expected.provider) mismatches.push("provider");
  if (actual.providerAccountId !== expected.providerAccountId) mismatches.push("providerAccountId");
  if (actual.providerMessageId !== expected.providerMessageId) mismatches.push("providerMessageId");
  if (actual.senderRef !== expected.senderRef) mismatches.push("senderRef");
  if (actual.contentKind !== expected.contentKind) mismatches.push("contentKind");
  if (mismatches.length > 0) {
    throw new Error(`WHATSAPP_RECEIPT_IDENTITY_CONFLICT: duplicate receipt row mismatched ${mismatches.join(",")}.`);
  }
}

async function findExistingByReceiptKey(
  client: SupabaseProviderInboundReceiptClient,
  tableName: string,
  row: WhatsAppProviderInboundReceiptRow,
): Promise<WhatsAppProviderInboundReceiptRow | undefined> {
  const result = await client.from(tableName)
    .select(receiptColumns)
    .eq("receipt_key", row.receiptKey)
    .eq("provider", "WHATSAPP")
    .maybeSingle();

  if (result.error) {
    throw new Error(`WHATSAPP_RECEIPT_DUPLICATE_LOOKUP_FAILED: ${result.error.message ?? result.error.code ?? "unknown lookup error"}`);
  }
  return result.data ? fromDbRow(result.data) : undefined;
}

async function findExistingByProviderMessageIdentity(
  client: SupabaseProviderInboundReceiptClient,
  tableName: string,
  row: WhatsAppProviderInboundReceiptRow,
): Promise<WhatsAppProviderInboundReceiptRow | undefined> {
  const result = await client.from(tableName)
    .select(receiptColumns)
    .eq("provider", "WHATSAPP")
    .eq("provider_account_id", row.providerAccountId)
    .eq("provider_message_id", row.providerMessageId)
    .maybeSingle();

  if (result.error) {
    throw new Error(`WHATSAPP_RECEIPT_DUPLICATE_LOOKUP_FAILED: ${result.error.message ?? result.error.code ?? "unknown lookup error"}`);
  }
  return result.data ? fromDbRow(result.data) : undefined;
}

async function findExistingDuplicate(
  client: SupabaseProviderInboundReceiptClient,
  tableName: string,
  row: WhatsAppProviderInboundReceiptRow,
): Promise<WhatsAppProviderInboundReceiptRow> {
  const byReceipt = await findExistingByReceiptKey(client, tableName, row);
  if (byReceipt) return byReceipt;

  const byProviderMessage = await findExistingByProviderMessageIdentity(client, tableName, row);
  if (byProviderMessage) return byProviderMessage;

  throw new Error("WHATSAPP_RECEIPT_DUPLICATE_NOT_FOUND: insert reported duplicate but no matching receipt row was found.");
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
    providerOccurredAt: normalizeProviderTimestampToIso(record.providerTimestamp),
    rawProviderEventRef: record.rawProviderEventRef,
    contentKind: record.contentKind,
  };
}

export function createSupabaseWhatsAppProviderReceiptGateway(
  client: SupabaseProviderInboundReceiptClient,
  options: SupabaseWhatsAppProviderReceiptGatewayOptions = {},
): WhatsAppProviderInboundReceiptGateway {
  const tableName = options.tableName ?? "provider_inbound_receipts";

  return {
    async insertReceipt(row: WhatsAppProviderInboundReceiptRow): Promise<DurableWhatsAppInboxPersistenceResult> {
      const inserted = await client.from(tableName)
        .insert(toDbRow(row))
        .select(receiptColumns)
        .maybeSingle();

      if (!inserted.error) {
        if (inserted.data) assertSameIdentity(row, fromDbRow(inserted.data));
        return "INSERTED";
      }

      if (!isDuplicateError(inserted.error)) {
        throw new Error(`WHATSAPP_RECEIPT_INSERT_FAILED: ${inserted.error.message ?? inserted.error.code ?? "unknown insert error"}`);
      }

      const existing = await findExistingDuplicate(client, tableName, row);
      assertSameIdentity(row, existing);
      return "DUPLICATE";
    },
  };
}

export function createWhatsAppProviderReceiptStore(gateway: WhatsAppProviderInboundReceiptGateway): DurableWhatsAppInboxStore {
  return {
    async persist(record: DurableWhatsAppInboxRecord): Promise<DurableWhatsAppInboxPersistenceResult> {
      return gateway.insertReceipt(toWhatsAppProviderInboundReceiptRow(record));
    },
  };
}
