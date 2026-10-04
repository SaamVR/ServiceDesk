import { parseInboundMessages, verifyMetaSignature } from "../integrations/whatsapp/adapter";
import {
  persistDurableWhatsAppInboundBatchWithRecords,
  rawWhatsAppProviderEventRef,
  type DurableWhatsAppInboxStore,
} from "../integrations/whatsapp/inbox-persistence";
import { processDurableWhatsAppInboundBatch, type DurableWhatsAppInboundProcessor } from "../integrations/whatsapp/inbound-processor";
import type { ProviderHandlerResult } from "./provider-whatsapp";

export type DurableWhatsAppInboundWebhookStore = DurableWhatsAppInboxStore;

export interface DurableWhatsAppInboundWebhookInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  appSecret: string;
  workspaceByPhoneNumberId: Record<string, string>;
  store: DurableWhatsAppInboundWebhookStore;
  processor: DurableWhatsAppInboundProcessor;
}

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const exact = headers[name];
  if (exact) return exact;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found?.[1];
}

export async function handleDurableWhatsAppInboundWebhook(input: DurableWhatsAppInboundWebhookInput): Promise<ProviderHandlerResult> {
  const signature = verifyMetaSignature(input.rawBody, header(input.headers, "x-hub-signature-256"), input.appSecret);
  if (!signature.ok) {
    return {
      statusCode: 401,
      body: signature.message,
      acknowledged: false,
      retryable: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    return {
      statusCode: 400,
      body: "Malformed WhatsApp webhook JSON.",
      acknowledged: false,
      retryable: false,
    };
  }

  const messages = parseInboundMessages(parsed, input.workspaceByPhoneNumberId);
  const summary = { received: messages.length, inserted: 0, duplicate: 0, unsupported: 0, processed: 0, processingDuplicate: 0 };

  const groups = new Map<string, typeof messages>();
  for (const message of messages) {
    const key = `${message.workspaceId}:${message.phoneNumberId}`;
    const group = groups.get(key) ?? [];
    group.push(message);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const persisted = await persistDurableWhatsAppInboundBatchWithRecords({
      messages: group,
      rawProviderEventRef: rawWhatsAppProviderEventRef({
        workspaceId: first.workspaceId,
        providerAccountId: first.phoneNumberId,
        rawBody: input.rawBody,
      }),
      store: input.store,
    });

    if (!persisted.ok) {
      return {
        statusCode: 503,
        body: `${persisted.code}: ${persisted.message}`,
        acknowledged: false,
        retryable: true,
      };
    }

    summary.inserted += persisted.value.summary.inserted;
    summary.duplicate += persisted.value.summary.duplicate;
    summary.unsupported += persisted.value.summary.unsupported;

    const processed = await processDurableWhatsAppInboundBatch(
      persisted.value.records.map((outcome) => outcome.record),
      input.processor,
    );
    if (!processed.ok) {
      return {
        statusCode: 503,
        body: `${processed.code}: ${processed.message}`,
        acknowledged: false,
        retryable: true,
      };
    }

    summary.processed += processed.value.processed;
    summary.processingDuplicate += processed.value.duplicate;
  }

  return {
    statusCode: 200,
    body: JSON.stringify(summary),
    acknowledged: true,
    retryable: false,
  };
}
