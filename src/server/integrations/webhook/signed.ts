import { createHmac, timingSafeEqual } from "node:crypto";
import type { Result } from "../../../contracts";

export interface BookingConfirmedWebhookInput {
  workspaceId: string;
  eventId: string;
  occurredAt: string;
  bookingId: string;
  requestId: string;
  customerRef: string;
  scheduledStartAt: string;
  totalMinor: number;
  depositMinor: number;
  currency: string;
}

export interface OutboundWebhookEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: "booking.confirmed";
  version: "2026-10-04";
  workspaceId: string;
  occurredAt: string;
  payload: TPayload;
}

export interface SignedOutboundWebhook {
  body: string;
  headers: Record<string, string>;
}

export interface WebhookDeliveryInput {
  statusCode?: number;
  errorCode?: string;
  attempt: number;
  maxAttempts: number;
}

export interface WebhookDeliveryDecision {
  outcome: "DELIVERED" | "RETRY" | "FAILED_FINAL";
  retryable: boolean;
  nextAttempt?: number;
  reason?: "SUCCESS" | "TRANSIENT_HTTP" | "NETWORK_ERROR" | "DETERMINISTIC_HTTP_FAILURE" | "MAX_ATTEMPTS_EXHAUSTED" | "DESTINATION_NOT_ALLOWED";
  businessMutationAllowed: false;
}

export function buildBookingConfirmedWebhook(input: BookingConfirmedWebhookInput): OutboundWebhookEnvelope {
  return {
    id: input.eventId,
    type: "booking.confirmed",
    version: "2026-10-04",
    workspaceId: input.workspaceId,
    occurredAt: input.occurredAt,
    payload: {
      bookingId: input.bookingId,
      requestId: input.requestId,
      customerRef: input.customerRef,
      scheduledStartAt: input.scheduledStartAt,
      amount: {
        totalMinor: input.totalMinor,
        depositMinor: input.depositMinor,
        currency: input.currency,
      },
    },
  };
}

function signatureBase(timestamp: string, body: string): string {
  return `${timestamp}.${body}`;
}

function hmac(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(signatureBase(timestamp, body)).digest("hex");
}

export function signOutboundWebhook(input: { envelope: OutboundWebhookEnvelope; secret: string; now: string }): SignedOutboundWebhook {
  const body = JSON.stringify(input.envelope);
  const digest = hmac(input.secret, input.now, body);
  return {
    body,
    headers: {
      "content-type": "application/json",
      "x-servicedesk-event": input.envelope.type,
      "x-servicedesk-event-id": input.envelope.id,
      "x-servicedesk-version": input.envelope.version,
      "x-servicedesk-timestamp": input.now,
      "x-servicedesk-signature": `sha256=${digest}`,
    },
  };
}

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const exact = headers[name];
  if (exact) return exact;
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyOutboundWebhookSignature(input: {
  body: string;
  headers: Record<string, string | undefined>;
  secret: string;
  now: string;
  toleranceSeconds?: number;
}): Result<true> {
  const timestamp = header(input.headers, "x-servicedesk-timestamp");
  const signature = header(input.headers, "x-servicedesk-signature");
  if (!timestamp || !signature?.startsWith("sha256=")) {
    return { ok: false, code: "WEBHOOK_SIGNATURE_MISSING", message: "Missing ServiceDesk webhook signature headers." };
  }

  const ageSeconds = Math.abs(new Date(input.now).getTime() - new Date(timestamp).getTime()) / 1000;
  if (ageSeconds > (input.toleranceSeconds ?? 300)) {
    return { ok: false, code: "WEBHOOK_SIGNATURE_STALE", message: "ServiceDesk webhook signature timestamp is outside tolerance." };
  }

  const expected = hmac(input.secret, timestamp, input.body);
  const received = signature.slice("sha256=".length);
  if (!safeEqualHex(expected, received)) {
    return { ok: false, code: "WEBHOOK_SIGNATURE_MISMATCH", message: "ServiceDesk webhook signature does not match payload." };
  }

  return { ok: true, value: true };
}

function canRetry(input: WebhookDeliveryInput): boolean {
  return input.attempt < input.maxAttempts;
}

export function classifyWebhookDeliveryResult(input: WebhookDeliveryInput): WebhookDeliveryDecision {
  const noBusinessMutation = { businessMutationAllowed: false as const };

  if (input.statusCode && input.statusCode >= 200 && input.statusCode < 300) {
    return { outcome: "DELIVERED", retryable: false, reason: "SUCCESS", ...noBusinessMutation };
  }

  const transientHttp = input.statusCode === 408 || input.statusCode === 409 || input.statusCode === 425 || input.statusCode === 429 || (input.statusCode !== undefined && input.statusCode >= 500);
  const networkError = Boolean(input.errorCode);

  if ((transientHttp || networkError) && canRetry(input)) {
    return {
      outcome: "RETRY",
      retryable: true,
      nextAttempt: input.attempt + 1,
      reason: networkError ? "NETWORK_ERROR" : "TRANSIENT_HTTP",
      ...noBusinessMutation,
    };
  }

  if (transientHttp || networkError) {
    return { outcome: "FAILED_FINAL", retryable: false, reason: "MAX_ATTEMPTS_EXHAUSTED", ...noBusinessMutation };
  }

  return { outcome: "FAILED_FINAL", retryable: false, reason: "DETERMINISTIC_HTTP_FAILURE", ...noBusinessMutation };
}

export function nextWebhookRetryAt(input: { now: string; attempt: number; maxDelayMinutes?: number }): string {
  const delayMinutes = Math.min(2 ** Math.max(input.attempt - 1, 0), input.maxDelayMinutes ?? 30);
  return new Date(new Date(input.now).getTime() + delayMinutes * 60_000).toISOString();
}
