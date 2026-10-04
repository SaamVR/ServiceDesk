import type { WhatsAppInboundMessage } from "./adapter";

export type NormalizedInboundContentKind = "TEXT" | "MEDIA_REFERENCE" | "UNSUPPORTED";

export interface NormalizedWhatsAppInboundEvent {
  provider: "WHATSAPP";
  workspaceId: string;
  providerAccountId: string;
  phoneNumberId: string;
  providerMessageId: string;
  receiptKey: string;
  senderRef: string;
  providerTimestamp: string;
  channel: "WHATSAPP";
  contentKind: NormalizedInboundContentKind;
  text?: string;
  media?: {
    provider: "WHATSAPP";
    providerMediaId: string;
  };
  rawPayloadIncluded: false;
  aiAuthoritative: false;
}

export interface NormalizedInboundBatchSummary {
  total: number;
  text: number;
  mediaReference: number;
  unsupported: number;
}

export function whatsappInboundReceiptKey(input: Pick<WhatsAppInboundMessage, "workspaceId" | "phoneNumberId" | "providerMessageId">): string {
  return `${input.workspaceId}:${input.phoneNumberId}:${input.providerMessageId}`;
}

export function normalizeWhatsAppInboundMessage(message: WhatsAppInboundMessage): NormalizedWhatsAppInboundEvent {
  const text = typeof message.text === "string" && message.text.trim() ? message.text : undefined;
  const mediaId = typeof message.mediaId === "string" && message.mediaId.trim() ? message.mediaId : undefined;

  const contentKind: NormalizedInboundContentKind =
    message.type === "text" && text
      ? "TEXT"
      : message.type === "image" && mediaId
        ? "MEDIA_REFERENCE"
        : "UNSUPPORTED";

  return {
    provider: "WHATSAPP",
    workspaceId: message.workspaceId,
    providerAccountId: message.phoneNumberId,
    phoneNumberId: message.phoneNumberId,
    providerMessageId: message.providerMessageId,
    receiptKey: whatsappInboundReceiptKey(message),
    senderRef: message.from,
    providerTimestamp: message.timestamp,
    channel: "WHATSAPP",
    contentKind,
    text: contentKind === "TEXT" ? text : undefined,
    media: contentKind === "MEDIA_REFERENCE" && mediaId ? { provider: "WHATSAPP", providerMediaId: mediaId } : undefined,
    rawPayloadIncluded: false,
    aiAuthoritative: false,
  };
}

export function summarizeNormalizedInboundBatch(events: NormalizedWhatsAppInboundEvent[]): NormalizedInboundBatchSummary {
  return events.reduce<NormalizedInboundBatchSummary>(
    (summary, event) => {
      summary.total += 1;
      if (event.contentKind === "TEXT") summary.text += 1;
      if (event.contentKind === "MEDIA_REFERENCE") summary.mediaReference += 1;
      if (event.contentKind === "UNSUPPORTED") summary.unsupported += 1;
      return summary;
    },
    { total: 0, text: 0, mediaReference: 0, unsupported: 0 },
  );
}
