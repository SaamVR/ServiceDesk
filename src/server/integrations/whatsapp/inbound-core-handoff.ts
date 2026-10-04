import type { Result } from "../../../contracts";
import type { DurableWhatsAppInboundProcessor, DurableWhatsAppInboundProcessingResult } from "./inbound-processor";
import type { DurableWhatsAppInboxRecord } from "./inbox-persistence";

export type WhatsAppInboundBusinessCommandResult = "APPLIED" | "DUPLICATE";

export interface WhatsAppInboundBusinessCommandInput {
  receiptKey: string;
  workspaceId: string;
  providerAccountId: string;
  providerMessageId: string;
  senderRef: string;
  providerTimestamp: string;
  contentKind: DurableWhatsAppInboxRecord["contentKind"];
  text?: string;
  media?: DurableWhatsAppInboxRecord["media"];
  rawProviderEventRef: string;
  idempotencyKey: string;
}

export interface WhatsAppInboundBusinessCommandPort {
  execute(input: WhatsAppInboundBusinessCommandInput): Promise<Result<WhatsAppInboundBusinessCommandResult>>;
}

export function toWhatsAppInboundBusinessCommandInput(record: DurableWhatsAppInboxRecord): WhatsAppInboundBusinessCommandInput {
  return {
    receiptKey: record.receiptKey,
    workspaceId: record.workspaceId,
    providerAccountId: record.providerAccountId,
    providerMessageId: record.providerMessageId,
    senderRef: record.senderRef,
    providerTimestamp: record.providerTimestamp,
    contentKind: record.contentKind,
    text: record.text,
    media: record.media,
    rawProviderEventRef: record.rawProviderEventRef,
    idempotencyKey: record.receiptKey,
  };
}

export function createWhatsAppInboundCoreHandoffProcessor(command: WhatsAppInboundBusinessCommandPort): DurableWhatsAppInboundProcessor {
  return {
    async process(record: DurableWhatsAppInboxRecord): Promise<DurableWhatsAppInboundProcessingResult> {
      if (record.contentKind === "UNSUPPORTED") return "DUPLICATE";
      const result = await command.execute(toWhatsAppInboundBusinessCommandInput(record));
      if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
      return result.value === "APPLIED" ? "PROCESSED" : "DUPLICATE";
    },
  };
}
