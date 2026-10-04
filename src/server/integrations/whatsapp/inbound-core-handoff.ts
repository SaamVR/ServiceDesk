import type { Result } from "../../../contracts";
import type { InboundMessageApplicationOutcome, InboundMessageEvent } from "../../core/facade";
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

export interface WhatsAppInboundCorePort {
  applyInboundMessage(event: InboundMessageEvent): Promise<Result<InboundMessageApplicationOutcome>>;
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

export function toInboundMessageEvent(record: DurableWhatsAppInboxRecord): InboundMessageEvent {
  return {
    receiptKey: record.receiptKey,
    workspaceId: record.workspaceId,
    channel: "WHATSAPP",
    providerAccountId: record.providerAccountId,
    providerMessageId: record.providerMessageId,
    senderRef: record.senderRef,
    occurredAt: record.providerTimestamp,
    contentKind: record.contentKind,
    text: record.text,
    media: record.media,
    rawProviderEventRef: record.rawProviderEventRef,
  };
}

function isCorePort(port: WhatsAppInboundCorePort | WhatsAppInboundBusinessCommandPort): port is WhatsAppInboundCorePort {
  return typeof (port as WhatsAppInboundCorePort).applyInboundMessage === "function";
}

async function applyRecord(
  port: WhatsAppInboundCorePort | WhatsAppInboundBusinessCommandPort,
  record: DurableWhatsAppInboxRecord,
): Promise<WhatsAppInboundBusinessCommandResult> {
  if (isCorePort(port)) {
    const result = await port.applyInboundMessage(toInboundMessageEvent(record));
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
    return result.value.state;
  }

  const result = await port.execute(toWhatsAppInboundBusinessCommandInput(record));
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.value;
}

export function createWhatsAppInboundCoreHandoffProcessor(port: WhatsAppInboundCorePort | WhatsAppInboundBusinessCommandPort): DurableWhatsAppInboundProcessor {
  return {
    async process(record: DurableWhatsAppInboxRecord): Promise<DurableWhatsAppInboundProcessingResult> {
      if (record.contentKind === "UNSUPPORTED") return "DUPLICATE";
      const result = await applyRecord(port, record);
      return result === "APPLIED" ? "PROCESSED" : "DUPLICATE";
    },
  };
}
