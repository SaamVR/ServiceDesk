import { createHmac, timingSafeEqual } from "node:crypto";

export interface EmailProviderHandlerResult {
  statusCode: number;
  body?: string;
  acknowledged: boolean;
  retryable: boolean;
}

export type EmailProviderEventType = "DELIVERED" | "BOUNCE" | "COMPLAINT";
export type EmailSuppressionAction = "NONE" | "SUPPRESS_RECIPIENT";

export interface EmailCallbackInput {
  provider: "EMAIL";
  callbackKey: string;
  workspaceId: string;
  providerMessageId: string;
  recipientRef: string;
  occurredAt: string;
  eventType: EmailProviderEventType;
  suppressionAction: EmailSuppressionAction;
  bounceType?: "hard" | "soft" | "unknown";
  reason?: string;
  rawProviderEvent: string;
}

export interface EmailCallbackStore {
  applyEmailCallback(input: EmailCallbackInput): Promise<"APPLIED" | "DUPLICATE">;
}

export interface EmailProviderCallbackRequest {
  rawBody: string;
  headers: Record<string, string | undefined>;
  webhookSecret: string;
  store: EmailCallbackStore;
}

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const exact = headers[name];
  if (exact) return exact;
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function verifySignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function normalizeType(type: unknown): EmailProviderEventType | undefined {
  if (type === "delivered" || type === "delivery" || type === "sent") return "DELIVERED";
  if (type === "bounce" || type === "bounced") return "BOUNCE";
  if (type === "complaint" || type === "spam_complaint") return "COMPLAINT";
  return undefined;
}

function normalizeBounceType(value: unknown): "hard" | "soft" | "unknown" | undefined {
  if (value === "hard" || value === "soft") return value;
  if (value === undefined || value === null || value === "") return undefined;
  return "unknown";
}

export async function handleEmailProviderCallback(input: EmailProviderCallbackRequest): Promise<EmailProviderHandlerResult> {
  const signature = header(input.headers, "x-servicedesk-email-signature");
  if (!verifySignature(input.rawBody, signature, input.webhookSecret)) {
    return {
      statusCode: 401,
      body: "Email callback signature missing or invalid.",
      acknowledged: false,
      retryable: false,
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(input.rawBody) as Record<string, unknown>;
  } catch {
    return {
      statusCode: 400,
      body: "Malformed email callback JSON.",
      acknowledged: false,
      retryable: false,
    };
  }

  const eventType = normalizeType(parsed.type);
  const callbackKey = String(parsed.id ?? "");
  const workspaceId = String(parsed.workspaceId ?? "");
  const providerMessageId = String(parsed.providerMessageId ?? "");
  const recipientRef = String(parsed.recipientRef ?? "");
  const occurredAt = String(parsed.occurredAt ?? "");

  if (!eventType || !callbackKey || !workspaceId || !providerMessageId || !recipientRef || !occurredAt) {
    return {
      statusCode: 400,
      body: "Email callback is missing required normalized fields.",
      acknowledged: false,
      retryable: false,
    };
  }

  const suppressionAction: EmailSuppressionAction = eventType === "BOUNCE" || eventType === "COMPLAINT" ? "SUPPRESS_RECIPIENT" : "NONE";

  try {
    await input.store.applyEmailCallback({
      provider: "EMAIL",
      callbackKey,
      workspaceId,
      providerMessageId,
      recipientRef,
      occurredAt,
      eventType,
      suppressionAction,
      bounceType: normalizeBounceType(parsed.bounceType),
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      rawProviderEvent: input.rawBody,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown persistence error";
    return {
      statusCode: 503,
      body: `Email callback persistence failed: ${detail}`,
      acknowledged: false,
      retryable: true,
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ accepted: true }),
    acknowledged: true,
    retryable: false,
  };
}
