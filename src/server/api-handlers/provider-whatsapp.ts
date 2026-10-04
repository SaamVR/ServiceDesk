import { parseInboundMessages, verifyMetaSignature, verifyWhatsAppWebhookChallenge, type WhatsAppInboundMessage, type WhatsAppWebhookChallengeQuery } from "../integrations/whatsapp/adapter";

export interface ProviderHandlerResult {
  statusCode: number;
  body?: string;
  acknowledged: boolean;
  retryable: boolean;
}

export interface PersistProviderInboxEventInput extends WhatsAppInboundMessage {
  provider: "WHATSAPP";
  providerAccountId: string;
  rawProviderEvent: string;
}

export interface ProviderInboxEventStore {
  persistInboundMessage(input: PersistProviderInboxEventInput): Promise<"INSERTED" | "DUPLICATE">;
}

export type WhatsAppDeliveryState = "PROVIDER_ACCEPTED" | "DELIVERED" | "READ" | "FAILED";
export type ProviderDeliveryStatusApplyResult = "APPLIED" | "DUPLICATE" | "STALE_REGRESSION";

export interface WhatsAppStatusCallbackInput {
  provider: "WHATSAPP";
  workspaceId: string;
  providerAccountId: string;
  phoneNumberId: string;
  providerMessageId: string;
  providerStatus: "sent" | "delivered" | "read" | "failed";
  deliveryState: WhatsAppDeliveryState;
  recipientId?: string;
  providerTimestamp: string;
  callbackKey: string;
  rawProviderEvent: string;
  errorCode?: number;
  errorTitle?: string;
}

export interface ProviderDeliveryStatusStore {
  applyStatusCallback(input: WhatsAppStatusCallbackInput): Promise<ProviderDeliveryStatusApplyResult>;
}

export interface WhatsAppInboundWebhookInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  appSecret: string;
  workspaceByPhoneNumberId: Record<string, string>;
  store: ProviderInboxEventStore;
}

export interface WhatsAppStatusWebhookInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  appSecret: string;
  workspaceByPhoneNumberId: Record<string, string>;
  store: ProviderDeliveryStatusStore;
}

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const exact = headers[name];
  if (exact) return exact;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found?.[1];
}

export function handleWhatsAppChallenge(query: WhatsAppWebhookChallengeQuery, expectedVerifyToken: string): ProviderHandlerResult {
  const challenge = verifyWhatsAppWebhookChallenge(query, expectedVerifyToken);
  if (!challenge.ok) {
    return {
      statusCode: challenge.code === "VERIFY_TOKEN_MISMATCH" ? 403 : 400,
      body: challenge.message,
      acknowledged: false,
      retryable: false,
    };
  }

  return {
    statusCode: 200,
    body: challenge.value,
    acknowledged: true,
    retryable: false,
  };
}

export async function handleWhatsAppInboundWebhook(input: WhatsAppInboundWebhookInput): Promise<ProviderHandlerResult> {
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

  const inboundMessages = parseInboundMessages(parsed, input.workspaceByPhoneNumberId);

  const summary = { received: inboundMessages.length, inserted: 0, duplicate: 0 };

  try {
    for (const message of inboundMessages) {
      const result = await input.store.persistInboundMessage({
        ...message,
        provider: "WHATSAPP",
        providerAccountId: message.phoneNumberId,
        rawProviderEvent: input.rawBody,
      });
      if (result === "INSERTED") summary.inserted += 1;
      if (result === "DUPLICATE") summary.duplicate += 1;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown persistence error";
    return {
      statusCode: 503,
      body: `WhatsApp inbound persistence failed: ${detail}`,
      acknowledged: false,
      retryable: true,
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(summary),
    acknowledged: true,
    retryable: false,
  };
}

function statusToDeliveryState(status: string): WhatsAppDeliveryState | null {
  switch (status) {
    case "sent":
      return "PROVIDER_ACCEPTED";
    case "delivered":
      return "DELIVERED";
    case "read":
      return "READ";
    case "failed":
      return "FAILED";
    default:
      return null;
  }
}

function parseStatusCallbacks(raw: unknown, workspaceByPhoneNumberId: Record<string, string>, rawProviderEvent: string): WhatsAppStatusCallbackInput[] {
  const payload = raw as {
    entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; statuses?: Array<Record<string, unknown>> } }> }>;
  };

  const callbacks: WhatsAppStatusCallbackInput[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const workspaceId = workspaceByPhoneNumberId[phoneNumberId];
      if (!workspaceId) continue;

      for (const status of change.value?.statuses ?? []) {
        const providerMessageId = String(status.id ?? "");
        const providerStatus = String(status.status ?? "");
        const providerTimestamp = String(status.timestamp ?? "");
        const deliveryState = statusToDeliveryState(providerStatus);
        if (!providerMessageId || !providerTimestamp || !deliveryState) continue;

        const errors = status.errors as Array<{ code?: number; title?: string }> | undefined;
        const firstError = errors?.[0];
        const recipientId = typeof status.recipient_id === "string" ? status.recipient_id : undefined;

        callbacks.push({
          provider: "WHATSAPP",
          workspaceId,
          providerAccountId: phoneNumberId,
          phoneNumberId,
          providerMessageId,
          providerStatus: providerStatus as "sent" | "delivered" | "read" | "failed",
          deliveryState,
          recipientId,
          providerTimestamp,
          callbackKey: `${phoneNumberId}:${providerMessageId}:${providerStatus}:${providerTimestamp}`,
          rawProviderEvent,
          errorCode: firstError?.code,
          errorTitle: firstError?.title,
        });
      }
    }
  }
  return callbacks;
}

export async function handleWhatsAppStatusWebhook(input: WhatsAppStatusWebhookInput): Promise<ProviderHandlerResult> {
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
      body: "Malformed WhatsApp status webhook JSON.",
      acknowledged: false,
      retryable: false,
    };
  }

  const callbacks = parseStatusCallbacks(parsed, input.workspaceByPhoneNumberId, input.rawBody);
  const summary = { applied: 0, duplicate: 0, stale: 0 };

  try {
    for (const callback of callbacks) {
      const result = await input.store.applyStatusCallback(callback);
      if (result === "APPLIED") summary.applied += 1;
      if (result === "DUPLICATE") summary.duplicate += 1;
      if (result === "STALE_REGRESSION") summary.stale += 1;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown persistence error";
    return {
      statusCode: 503,
      body: `WhatsApp status persistence failed: ${detail}`,
      acknowledged: false,
      retryable: true,
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(summary),
    acknowledged: true,
    retryable: false,
  };
}
