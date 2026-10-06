import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ServiceDeskFacade } from "../core/facade";
import { normalizeEmailInbound } from "../integrations/email/inbound-normalization";
import type { EmailProviderHandlerResult } from "./provider-email";

export interface EmailInboundWebhookInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  webhookSecret: string;
  workspaceByProviderAccountId: Readonly<Record<string, string>>;
  store: Pick<ServiceDeskFacade, "applyInboundMessage">;
}

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const exact = headers[name];
  if (exact) return exact;
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function verifySignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function rawEventReference(rawBody: string): string {
  return "email-webhook:sha256:" + createHash("sha256").update(rawBody).digest("hex");
}

export async function handleEmailInboundWebhook(
  input: EmailInboundWebhookInput,
): Promise<EmailProviderHandlerResult> {
  const signature = header(input.headers, "x-servicedesk-email-signature");
  if (!verifySignature(input.rawBody, signature, input.webhookSecret)) {
    return {
      statusCode: 401,
      body: "Email inbound signature missing or invalid.",
      acknowledged: false,
      retryable: false,
    };
  }

  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = asRecord(JSON.parse(input.rawBody));
  } catch {
    parsed = undefined;
  }
  if (!parsed) {
    return {
      statusCode: 400,
      body: "Malformed email inbound JSON.",
      acknowledged: false,
      retryable: false,
    };
  }

  if ("attachments" in parsed || "attachment" in parsed || parsed.contentKind === "MEDIA_REFERENCE") {
    return {
      statusCode: 400,
      body: "EMAIL_INBOUND_ATTACHMENTS_UNSUPPORTED: Email attachments are outside this intake boundary.",
      acknowledged: false,
      retryable: false,
    };
  }

  const providerAccountId = text(parsed, "providerAccountId").trim();
  const workspaceId = input.workspaceByProviderAccountId[providerAccountId];
  if (!providerAccountId || !workspaceId) {
    return {
      statusCode: 400,
      body: "EMAIL_INBOUND_ACCOUNT_UNMAPPED: Provider account is not mapped to an authorized workspace.",
      acknowledged: false,
      retryable: false,
    };
  }

  const normalized = normalizeEmailInbound({
    workspaceId,
    providerAccountId,
    providerMessageId: text(parsed, "providerMessageId"),
    receiptKey: text(parsed, "receiptKey"),
    senderEmail: text(parsed, "senderEmail"),
    occurredAt: text(parsed, "occurredAt"),
    text: text(parsed, "text"),
    rawProviderEventRef: rawEventReference(input.rawBody),
  });
  if (!normalized.ok) {
    return {
      statusCode: 400,
      body: `${normalized.code}: ${normalized.message}`,
      acknowledged: false,
      retryable: false,
    };
  }

  const applied = await input.store.applyInboundMessage(normalized.value);
  if (!applied.ok) {
    return {
      statusCode: 503,
      body: `${applied.code}: Email inbound persistence failed.`,
      acknowledged: false,
      retryable: true,
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      accepted: true,
      state: applied.value.state,
      conversationId: applied.value.conversation.id,
    }),
    acknowledged: true,
    retryable: false,
  };
}
