import type { Result } from "../../../contracts";
import type { OutboxJob, RedactedProviderEvidence } from "../types";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher, type CommittedOutboxDispatchInput, type CommittedOutboxDispatchOutcome } from "./dispatch-port";
import { classifyProviderFailure } from "./failure-policy";

export interface ResolvedWebhookDeliveryIntent {
  endpointId: string;
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  body: unknown;
  evidence?: RedactedProviderEvidence;
}

export interface WebhookDeliveryIntentResolver {
  resolve(job: OutboxJob): Promise<Result<ResolvedWebhookDeliveryIntent>>;
}

export interface WebhookDispatchRequest {
  endpointId: string;
  url: string;
  method: "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  body: unknown;
  idempotencyKey: string;
}

export interface WebhookDispatchResponse {
  status: number;
  providerMessageId?: string;
  acceptedAt?: string;
  retryAfterSeconds?: number;
}

export type WebhookDispatchTransport = (request: WebhookDispatchRequest) => Promise<WebhookDispatchResponse>;

function validUrl(value: string): boolean {
  if (!value || value.length > 2048 || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    // Defense at the final dispatch port, not just at the resolver. Webhook
    // secrets, client data and request metadata must not reach loopback,
    // metadata IPs, credentialed or non-HTTPS destinations.
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port && !url.hash &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) &&
      !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) &&
      ![".local", ".localhost", ".internal"].some(suffix => host.endsWith(suffix));
  } catch {
    return false;
  }
}

function headersAreSafe(headers: Record<string, string>): boolean {
  const prohibited = new Set([
    "host", "connection", "proxy-authorization", "proxy-connection",
    "transfer-encoding", "content-length", "te", "trailer", "upgrade",
  ]);
  return Object.entries(headers).every(([name, value]) =>
    /^[a-z0-9!#$%&'*+.^_`|~-]+$/i.test(name) &&
    !prohibited.has(name.toLowerCase()) &&
    typeof value === "string" && value.length <= 4096 &&
    !/[\r\n\u0000]/.test(value));
}

function fallbackEvidence(job: OutboxJob, endpointId: string, capturedAt: string): RedactedProviderEvidence {
  return {
    provider: "WEBHOOK",
    mode: "SANDBOX",
    verification: "CONTRACT_TESTED",
    capturedAt,
    controlledId: endpointId,
    notes: ["Webhook dispatch used server-resolved endpoint/config; raw response and secret material are not stored in connector outcome."],
  };
}

function statusCodeToFailureCode(status: number): string {
  if (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500) return `HTTP_${status}`;
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 400) return "INVALID_REQUEST";
  return "WEBHOOK_DELIVERY_TERMINAL";
}

export class WebhookCommittedOutboxDispatcher implements CommittedOutboxDispatcher {
  constructor(
    private readonly resolver: WebhookDeliveryIntentResolver,
    private readonly transport: WebhookDispatchTransport,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async dispatch(input: CommittedOutboxDispatchInput): Promise<Result<CommittedOutboxDispatchOutcome>> {
    if (input.job.channel !== "WEBHOOK" || input.expectedChannel !== "WEBHOOK") {
      return { ok: true, value: classifyProviderFailure({ job: input.job, code: "CHANNEL_MISMATCH", message: "Webhook dispatcher received a non-webhook outbox job." }) };
    }
    if (input.expectedWorkspaceId && input.expectedWorkspaceId !== input.job.workspaceId) {
      return { ok: true, value: classifyProviderFailure({ job: input.job,
        code: "WORKSPACE_MISMATCH", message: "Webhook outbox job is not owned by the expected workspace." }) };
    }

    let resolved: Awaited<ReturnType<WebhookDeliveryIntentResolver["resolve"]>>;
    try {
      resolved = await this.resolver.resolve(input.job);
    } catch {
      // A resolver may fail while loading server-held endpoint credentials.
      // Its exception is untrusted and must never enter the persisted outbox.
      return { ok: true, value: classifyProviderFailure({
        job: input.job, code: "WEBHOOK_CONFIG_INVALID",
        message: "Authoritative webhook delivery configuration is unavailable.",
      }) };
    }
    if (!resolved.ok) return { ok: true, value: classifyProviderFailure({
      job: input.job, code: resolved.code,
      message: "Authoritative webhook destination could not be resolved.",
    }) };
    if (!validUrl(resolved.value.url) ||
        !headersAreSafe(resolved.value.headers ?? {})) {
      return { ok: true, value: classifyProviderFailure({ job: input.job, code: "WEBHOOK_CONFIG_INVALID", message: "Server-resolved webhook endpoint URL is invalid." }) };
    }

    try {
      const response = await this.transport({
        endpointId: resolved.value.endpointId,
        url: resolved.value.url,
        method: resolved.value.method ?? "POST",
        headers: resolved.value.headers ?? {},
        body: resolved.value.body,
        idempotencyKey: input.job.idempotencyKey,
      });

      if (response.status >= 200 && response.status < 300) {
        const acceptedAt = response.acceptedAt ?? this.now();
        const providerMessageId = response.providerMessageId ?? `webhook:${resolved.value.endpointId}:${input.job.id}`;
        return {
          ok: true,
          value: {
            ...dispatchOutcomeBase(input.job),
            outcome: "ACCEPTED",
            providerMessageId,
            acceptedAt,
            providerMode: resolved.value.evidence?.mode ?? "SANDBOX",
            evidence: resolved.value.evidence ?? fallbackEvidence(input.job, resolved.value.endpointId, acceptedAt),
          },
        };
      }

      return {
        ok: true,
        value: classifyProviderFailure({
          job: input.job,
          code: statusCodeToFailureCode(response.status),
          message: `Webhook delivery failed with HTTP ${response.status}.`,
          retryAfterSeconds: response.retryAfterSeconds,
          evidence: resolved.value.evidence,
        }),
      };
    } catch {
      // Transport errors can embed provider keys, request bodies, host URLs
      // and customer data that a regex redactor cannot safely enumerate.
      return { ok: true, value: classifyProviderFailure({
        job: input.job, code: "NETWORK_ERROR",
        message: "Webhook transport failed before a verified provider response.",
      }) };
    }
  }
}
