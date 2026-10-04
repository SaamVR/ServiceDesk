import { createHmac } from "node:crypto";
import type { Result } from "../../../contracts";
import type { OutboxJob, RedactedProviderEvidence } from "../types";
import type { ResolvedWebhookDeliveryIntent, WebhookDeliveryIntentResolver } from "../outbox/webhook-dispatcher";

export interface AuthoritativeWebhookDestination {
  endpointId: string;
  workflowId: string;
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  allowedHost: string;
  signingSecretRef: string;
  signingSecret: string;
  headers?: Record<string, string>;
  body: unknown;
  evidence?: RedactedProviderEvidence;
}

export interface AuthoritativeWebhookDestinationResolver {
  resolve(job: OutboxJob): Promise<Result<AuthoritativeWebhookDestination>>;
}

function isHttpsAllowed(urlValue: string, allowedHost: string): boolean {
  try {
    const url = new URL(urlValue);
    return url.protocol === "https:" && url.hostname === allowedHost;
  } catch {
    return false;
  }
}

function canonicalBody(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function buildSignedWebhookIntent(destination: AuthoritativeWebhookDestination, job: OutboxJob): Result<ResolvedWebhookDeliveryIntent> {
  if (!destination.signingSecretRef || !destination.signingSecret) {
    return { ok: false, code: "WEBHOOK_SIGNING_CONFIG_MISSING", message: "Webhook signing secret reference is not configured." };
  }
  if (!isHttpsAllowed(destination.url, destination.allowedHost)) {
    return { ok: false, code: "WEBHOOK_INVALID_DESTINATION", message: "Webhook destination must be HTTPS and match the server-side allowlist." };
  }

  const body = canonicalBody(destination.body);
  const signature = createHmac("sha256", destination.signingSecret).update(body).digest("hex");
  const capturedAt = new Date().toISOString();

  return {
    ok: true,
    value: {
      endpointId: destination.endpointId,
      url: destination.url,
      method: destination.method ?? "POST",
      headers: {
        ...(destination.headers ?? {}),
        "x-servicedesk-signature": `sha256=${signature}`,
        "x-servicedesk-signing-key-ref": destination.signingSecretRef,
        "x-servicedesk-idempotency-key": job.idempotencyKey,
        "x-servicedesk-workflow-id": destination.workflowId,
      },
      body: destination.body,
      evidence: destination.evidence ?? {
        provider: "WEBHOOK",
        mode: "SANDBOX",
        verification: "CONTRACT_TESTED",
        capturedAt,
        controlledId: destination.endpointId,
        notes: [
          `Server-resolved webhook destination ${destination.endpointId} for workflow ${destination.workflowId}.`,
          "Endpoint URL and signing secret are resolved from authoritative server configuration, not outbox payload.",
        ],
      },
    },
  };
}

export class AuthoritativeWebhookDeliveryIntentResolver implements WebhookDeliveryIntentResolver {
  constructor(private readonly resolver: AuthoritativeWebhookDestinationResolver) {}

  async resolve(job: OutboxJob): Promise<Result<ResolvedWebhookDeliveryIntent>> {
    const resolved = await this.resolver.resolve(job);
    if (!resolved.ok) return resolved;
    return buildSignedWebhookIntent(resolved.value, job);
  }
}
