import { isIP } from "node:net";
import type { Result } from "../../../contracts";
import { classifyWebhookDeliveryResult, nextWebhookRetryAt, signOutboundWebhook, type OutboundWebhookEnvelope, type WebhookDeliveryDecision } from "./signed";

export interface WebhookExecutorConfig {
  endpointUrl: string;
  signingSecret: string;
  now: () => string;
  maxAttempts: number;
  timeoutMs?: number;
  allowedHosts?: string[];
}

export interface WebhookExecutorRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export interface WebhookExecutorResponse {
  statusCode: number;
  body?: string;
}

export type WebhookExecutorTransport = (request: WebhookExecutorRequest) => Promise<WebhookExecutorResponse>;

export interface WebhookExecutionInput {
  envelope: OutboundWebhookEnvelope;
  attempt: number;
}

export interface WebhookExecutionResult extends WebhookDeliveryDecision {
  eventId: string;
  attempt: number;
  maxAttempts: number;
  endpointHost?: string;
  statusCode?: number;
  nextAttemptAt?: string;
  redactedResponseExcerpt?: string;
}

function validateDestination(config: WebhookExecutorConfig): Result<{ url: URL; host: string }> {
  let parsed: URL;
  try {
    parsed = new URL(config.endpointUrl);
  } catch {
    return { ok: false, code: "WEBHOOK_DESTINATION_INVALID", message: "Webhook destination URL is invalid." };
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.port || parsed.hash || !parsed.hostname.includes(".") ||
      isIP(parsed.hostname) !== 0 || parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".localhost") ||
      parsed.hostname.endsWith(".local") ||
      parsed.hostname.endsWith(".internal")) {
    return { ok: false, code: "WEBHOOK_DESTINATION_INVALID",
      message: "Webhook destination must be a safe public HTTPS hostname." };
  }
  // Missing or empty allowlists never grant outbound access to customer data.
  if (!Array.isArray(config.allowedHosts) || config.allowedHosts.length === 0 ||
      !config.allowedHosts.includes(parsed.hostname)) {
    return { ok: false, code: "WEBHOOK_DESTINATION_NOT_ALLOWED",
      message: "Webhook destination host is not allowlisted." };
  }
  return { ok: true, value: { url: parsed, host: parsed.host } };
}

function redactedExcerpt(body: string | undefined): string | undefined {
  // Provider responses can echo customer text, auth tokens and private IDs.
  // A fixed marker avoids partial regex redaction leaking sensitive content.
  return body ? "[provider-response-redacted]" : undefined;
}

function finalResult(input: {
  decision: WebhookDeliveryDecision;
  eventId: string;
  attempt: number;
  maxAttempts: number;
  endpointHost?: string;
  statusCode?: number;
  responseBody?: string;
  now: string;
}): WebhookExecutionResult {
  return {
    ...input.decision,
    eventId: input.eventId,
    attempt: input.attempt,
    maxAttempts: input.maxAttempts,
    endpointHost: input.endpointHost,
    statusCode: input.statusCode,
    nextAttemptAt: input.decision.retryable && input.decision.nextAttempt ? nextWebhookRetryAt({ now: input.now, attempt: input.attempt }) : undefined,
    redactedResponseExcerpt: input.decision.outcome === "DELIVERED" ? undefined : redactedExcerpt(input.responseBody),
  };
}

export async function executeSignedWebhookDelivery(
  config: WebhookExecutorConfig,
  input: WebhookExecutionInput,
  transport: WebhookExecutorTransport,
): Promise<WebhookExecutionResult> {
  const now = config.now();
  const destination = validateDestination(config);
  const validAttempt = Number.isSafeInteger(input.attempt) &&
    Number.isSafeInteger(config.maxAttempts) &&
    input.attempt >= 1 && config.maxAttempts >= 1 &&
    input.attempt <= config.maxAttempts && config.maxAttempts <= 25;
  if (!validAttempt || !config.signingSecret ||
      !Number.isFinite(Date.parse(now))) {
    return {eventId:input.envelope.id,attempt:input.attempt,
      maxAttempts:config.maxAttempts,outcome:"FAILED_FINAL",
      retryable:false,reason:"DETERMINISTIC_HTTP_FAILURE",
      businessMutationAllowed:false};
  }
  if (!destination.ok) {
    return {
      eventId: input.envelope.id,
      attempt: input.attempt,
      maxAttempts: config.maxAttempts,
      outcome: "FAILED_FINAL",
      retryable: false,
      reason: destination.code === "WEBHOOK_DESTINATION_NOT_ALLOWED" ? "DESTINATION_NOT_ALLOWED" : "DETERMINISTIC_HTTP_FAILURE",
      businessMutationAllowed: false,
    } as WebhookExecutionResult;
  }

  const signed = signOutboundWebhook({ envelope: input.envelope, secret: config.signingSecret, now });
  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await transport({
      url: config.endpointUrl,
      method: "POST",
      headers: signed.headers,
      body: signed.body,
      signal: controller.signal,
    });
    const decision = classifyWebhookDeliveryResult({ statusCode: response.statusCode, attempt: input.attempt, maxAttempts: config.maxAttempts });
    return finalResult({
      decision,
      eventId: input.envelope.id,
      attempt: input.attempt,
      maxAttempts: config.maxAttempts,
      endpointHost: destination.value.host,
      statusCode: response.statusCode,
      responseBody: response.body,
      now,
    });
  } catch (error) {
    const errorCode = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError") ? "TIMEOUT" : "NETWORK_ERROR";
    const decision = classifyWebhookDeliveryResult({ errorCode, attempt: input.attempt, maxAttempts: config.maxAttempts });
    return finalResult({
      decision,
      eventId: input.envelope.id,
      attempt: input.attempt,
      maxAttempts: config.maxAttempts,
      endpointHost: destination.value.host,
      responseBody: errorCode,
      now,
    });
  } finally {
    clearTimeout(timeout);
  }
}
