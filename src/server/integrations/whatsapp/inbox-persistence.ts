import { createHash } from "node:crypto";
import type { Result } from "../../../contracts";
import type { WhatsAppInboundMessage } from "./adapter";
import { normalizeWhatsAppInboundMessage, type NormalizedWhatsAppInboundEvent } from "./inbound-normalization";

export interface DurableWhatsAppInboxRecord extends NormalizedWhatsAppInboundEvent {
  rawProviderEventRef: string;
}

export interface DurableWhatsAppInboundBatchSummary {
  received: number;
  inserted: number;
  duplicate: number;
  unsupported: number;
}

export interface DurableWhatsAppInboxStore {
  persist(record: DurableWhatsAppInboxRecord): Promise<"INSERTED" | "DUPLICATE">;
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

export async function persistDurableWhatsAppInboundBatch(
  input: PersistDurableWhatsAppInboundBatchInput,
): Promise<Result<DurableWhatsAppInboundBatchSummary>> {
  const summary: DurableWhatsAppInboundBatchSummary = {
    received: input.messages.length,
    inserted: 0,
    duplicate: 0,
    unsupported: 0,
  };

  for (const message of input.messages) {
    const record = buildDurableWhatsAppInboxRecord(message, input.rawProviderEventRef);
    if (record.contentKind === "UNSUPPORTED") summary.unsupported += 1;

    try {
      const result = await input.store.persist(record);
      if (result === "INSERTED") summary.inserted += 1;
      if (result === "DUPLICATE") summary.duplicate += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown inbox persistence error";
      return {
        ok: false,
        code: "WHATSAPP_INBOUND_BATCH_PERSISTENCE_FAILED",
        message: `WhatsApp inbound batch persistence failed for ${record.receiptKey}: ${detail}`,
      };
    }
  }

  return { ok: true, value: summary };
}
