import { createHash } from "node:crypto";
import type { Result } from "../../../contracts";
import type { WhatsAppInboundMessage } from "./adapter";
import { normalizeWhatsAppInboundMessage, type NormalizedWhatsAppInboundEvent } from "./inbound-normalization";

export interface DurableWhatsAppInboxRecord extends NormalizedWhatsAppInboundEvent {
  rawProviderEventRef: string;
}

export type DurableWhatsAppInboxPersistenceResult = "INSERTED" | "DUPLICATE";

export interface DurableWhatsAppInboundBatchSummary {
  received: number;
  inserted: number;
  duplicate: number;
  unsupported: number;
}

export interface DurableWhatsAppInboundRecordOutcome {
  record: DurableWhatsAppInboxRecord;
  persistenceResult: DurableWhatsAppInboxPersistenceResult;
}

export interface DurableWhatsAppInboundBatchWithRecords {
  summary: DurableWhatsAppInboundBatchSummary;
  records: DurableWhatsAppInboundRecordOutcome[];
}

export interface DurableWhatsAppInboxStore {
  persist(record: DurableWhatsAppInboxRecord): Promise<DurableWhatsAppInboxPersistenceResult>;
}

export interface PersistDurableWhatsAppInboundBatchInput {
  messages: WhatsAppInboundMessage[];
  rawProviderEventRef: string;
  store: DurableWhatsAppInboxStore;
}

export interface RawWhatsAppProviderEventRefInput {
  workspaceId: string;
  providerAccountId: string;
  rawBody: string;
}

export function rawWhatsAppProviderEventRef(input: RawWhatsAppProviderEventRefInput): string {
  const digest = createHash("sha256")
    .update(`${input.workspaceId}:${input.providerAccountId}:${input.rawBody}`)
    .digest("hex")
    .slice(0, 16);
  return `whatsapp_raw:${input.workspaceId}:${input.providerAccountId}:${digest}`;
}

export function buildDurableWhatsAppInboxRecord(message: WhatsAppInboundMessage, rawProviderEventRef: string): DurableWhatsAppInboxRecord {
  return {
    ...normalizeWhatsAppInboundMessage(message),
    rawProviderEventRef,
  };
}

export async function persistDurableWhatsAppInboundBatchWithRecords(
  input: PersistDurableWhatsAppInboundBatchInput,
): Promise<Result<DurableWhatsAppInboundBatchWithRecords>> {
  const summary: DurableWhatsAppInboundBatchSummary = {
    received: input.messages.length,
    inserted: 0,
    duplicate: 0,
    unsupported: 0,
  };
  const records: DurableWhatsAppInboundRecordOutcome[] = [];

  for (const message of input.messages) {
    const record = buildDurableWhatsAppInboxRecord(message, input.rawProviderEventRef);
    if (record.contentKind === "UNSUPPORTED") summary.unsupported += 1;

    try {
      const persistenceResult = await input.store.persist(record);
      if (persistenceResult === "INSERTED") summary.inserted += 1;
      if (persistenceResult === "DUPLICATE") summary.duplicate += 1;
      records.push({ record, persistenceResult });
    } catch {
      // Downstream failure details and provider receipt keys must never be
      // reflected to an external webhook caller. A 503 still requests retry.
      return {
        ok: false,
        code: "WHATSAPP_INBOUND_BATCH_PERSISTENCE_FAILED",
        message: "WhatsApp inbound batch persistence failed; retry is required.",
      };
    }
  }

  return { ok: true, value: { summary, records } };
}

export async function persistDurableWhatsAppInboundBatch(
  input: PersistDurableWhatsAppInboundBatchInput,
): Promise<Result<DurableWhatsAppInboundBatchSummary>> {
  const persisted = await persistDurableWhatsAppInboundBatchWithRecords(input);
  if (!persisted.ok) return persisted;
  return { ok: true, value: persisted.value.summary };
}
