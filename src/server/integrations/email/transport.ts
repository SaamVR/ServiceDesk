import type { Result } from "../../../contracts";
import type { ProviderMode, RedactedProviderEvidence } from "../types";
import { shouldSuppressTransactionalEmail, type TransactionalEmailAdapter, type TransactionalEmailJob, type TransactionalEmailSendResult } from "./adapter";

export interface EmailTransportConfig {
  endpointUrl: string;
  apiKey: string;
  providerName: string;
  senderAddress: string;
  mode: ProviderMode;
  timeoutMs?: number;
  now: () => string;
}

export interface EmailHttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export interface EmailHttpResponse {
  status: number;
  body: string;
}

export type EmailHttpTransport = (request: EmailHttpRequest) => Promise<EmailHttpResponse>;

export interface RedactedEmailRequestSummary {
  method: "POST";
  host: string;
  endpoint: string;
  hasBearerAuthorization: boolean;
  hasIdempotencyKey: boolean;
  bodyKeys: string[];
}

function isValidEmailRef(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function providerFailure(status: number): Result<never> {
  if (status === 400) return { ok: false, code: "EMAIL_INVALID_REQUEST", message: "Email provider rejected the normalized transactional payload." };
  if (status === 401 || status === 403) return { ok: false, code: "EMAIL_CONFIGURATION_BLOCKED", message: "Email provider authentication or sender/domain authorization failed." };
  if (status === 409) return { ok: false, code: "EMAIL_PROVIDER_CONFLICT", message: "Email provider reported an idempotency or delivery conflict." };
  if (status === 422) return { ok: false, code: "EMAIL_RECIPIENT_REJECTED", message: "Email provider rejected the recipient or sender policy." };
  if (status === 429) return { ok: false, code: "EMAIL_RATE_LIMITED", message: "Email provider rate limit reached." };
  if (status >= 500) return { ok: false, code: "EMAIL_TRANSIENT_FAILURE", message: "Email provider returned a transient server failure." };
  return { ok: false, code: "EMAIL_PROVIDER_REJECTED", message: "Email provider rejected the transactional send." };
}

function evidence(config: EmailTransportConfig, providerMessageId: string, job: TransactionalEmailJob): RedactedProviderEvidence {
  return {
    provider: "EMAIL",
    mode: config.mode,
    verification: "CONTRACT_TESTED",
    capturedAt: config.now(),
    controlledId: providerMessageId,
    redactedReceipt: `${providerMessageId.slice(0, 8)}…${providerMessageId.slice(-4)}`,
    notes: [
      `${config.providerName} accepted ${job.purpose} transactional email through injected transport.`,
      "Provider acceptance is not delivery/open proof; controlled provider receipt required before PROVIDER_VERIFIED.",
    ],
  };
}

function bodyFor(config: EmailTransportConfig, job: TransactionalEmailJob): string {
  return JSON.stringify({
    from: config.senderAddress,
    to: job.to,
    subject: job.subject,
    text: job.text,
    html: job.html,
    purpose: job.purpose,
    workspaceId: job.workspaceId,
    templateRef: job.purpose,
  });
}

function parseProviderMessageId(body: string): Result<string> {
  try {
    const parsed = JSON.parse(body) as { id?: unknown; messageId?: unknown };
    const id = typeof parsed.id === "string" ? parsed.id : typeof parsed.messageId === "string" ? parsed.messageId : undefined;
    if (!id?.trim()) return { ok: false, code: "EMAIL_PROVIDER_INVALID_RESPONSE", message: "Email provider response is missing message id." };
    return { ok: true, value: id };
  } catch {
    return { ok: false, code: "EMAIL_PROVIDER_INVALID_RESPONSE", message: "Email provider response was malformed JSON." };
  }
}

export function redactedEmailRequestSummary(request: EmailHttpRequest): RedactedEmailRequestSummary {
  const url = new URL(request.url);
  let bodyKeys: string[] = [];
  try {
    bodyKeys = Object.keys(JSON.parse(request.body) as Record<string, unknown>).sort();
  } catch {
    bodyKeys = ["unparseable-json-body"];
  }
  return {
    method: request.method,
    host: url.host,
    endpoint: url.pathname,
    hasBearerAuthorization: request.headers.authorization?.startsWith("Bearer ") === true,
    hasIdempotencyKey: Boolean(request.headers["idempotency-key"]),
    bodyKeys,
  };
}

export function createConfiguredEmailTransport(config: EmailTransportConfig, http: EmailHttpTransport): TransactionalEmailAdapter {
  return {
    async send(job: TransactionalEmailJob): Promise<Result<TransactionalEmailSendResult>> {
      if (!config.endpointUrl || !config.apiKey || !config.senderAddress) {
        return { ok: false, code: "EMAIL_CONFIGURATION_BLOCKED", message: "Transactional email configuration is incomplete." };
      }

      const suppression = shouldSuppressTransactionalEmail(job);
      if (suppression) return { ok: false, code: suppression, message: "Transactional email suppressed before provider call." };
      if (!isValidEmailRef(job.to) || !isValidEmailRef(config.senderAddress)) {
        return { ok: false, code: "EMAIL_ADDRESS_INVALID", message: "Transactional email sender or recipient is invalid." };
      }
      if (!job.subject.trim() || job.subject.length > 240) {
        return { ok: false, code: "EMAIL_SUBJECT_INVALID", message: "Transactional email subject is missing or too long." };
      }
      if (!job.text.trim() && !job.html.trim()) {
        return { ok: false, code: "EMAIL_BODY_INVALID", message: "Transactional email must include text or HTML content." };
      }

      const controller = new AbortController();
      const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await http({
          url: config.endpointUrl,
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
            "idempotency-key": job.idempotencyKey,
          },
          body: bodyFor(config, job),
          signal: controller.signal,
        });

        if (response.status < 200 || response.status >= 300) return providerFailure(response.status);
        const providerMessageId = parseProviderMessageId(response.body);
        if (!providerMessageId.ok) return providerMessageId;

        return {
          ok: true,
          value: {
            idempotencyKey: job.idempotencyKey,
            providerMessageId: providerMessageId.value,
            acceptedAt: config.now(),
            mode: config.mode,
            evidence: evidence(config, providerMessageId.value, job),
          },
        };
      } catch (error) {
        if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
          return { ok: false, code: "EMAIL_TIMEOUT", message: "Email provider request timed out." };
        }
        return { ok: false, code: "EMAIL_NETWORK_FAILURE", message: "Email provider request failed before a valid response was received." };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
