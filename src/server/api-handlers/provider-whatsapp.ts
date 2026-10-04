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

export interface WhatsAppInboundWebhookInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  appSecret: string;
  workspaceByPhoneNumberId: Record<string, string>;
  store: ProviderInboxEventStore;
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

  try {
    for (const message of inboundMessages) {
      await input.store.persistInboundMessage({
        ...message,
        provider: "WHATSAPP",
        providerAccountId: message.phoneNumberId,
        rawProviderEvent: input.rawBody,
      });
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
    body: JSON.stringify({ persisted: inboundMessages.length }),
    acknowledged: true,
    retryable: false,
  };
}
