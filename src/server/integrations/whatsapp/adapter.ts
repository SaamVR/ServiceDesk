import { createHmac, timingSafeEqual } from "node:crypto";
import type { Result } from "../../../contracts";
import { hasRecipientSuppression, type MessagingAdapter, type OutboxJob, type ProviderSendResult } from "../types";

export interface WhatsAppWebhookChallengeQuery {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
}

export interface WhatsAppInboundMessage {
  workspaceId: string;
  phoneNumberId: string;
  providerMessageId: string;
  from: string;
  timestamp: string;
  type: "text" | "image" | "unsupported";
  text?: string;
  mediaId?: string;
}

export class InMemoryInboundDedupe {
  private readonly seen = new Set<string>();

  accept(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

export function verifyWhatsAppWebhookChallenge(query: WhatsAppWebhookChallengeQuery, expectedVerifyToken: string): Result<string> {
  if (query["hub.mode"] !== "subscribe" || !query["hub.challenge"]) {
    return { ok: false, code: "INVALID_CHALLENGE", message: "WhatsApp webhook challenge mode or challenge is missing." };
  }
  if (query["hub.verify_token"] !== expectedVerifyToken) {
    return { ok: false, code: "VERIFY_TOKEN_MISMATCH", message: "WhatsApp webhook verify token did not match." };
  }
  return { ok: true, value: query["hub.challenge"] };
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | undefined, appSecret: string): Result<true> {
  if (!signatureHeader?.startsWith("sha256=")) {
    return { ok: false, code: "MISSING_SIGNATURE", message: "Missing X-Hub-Signature-256 header." };
  }

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return { ok: false, code: "SIGNATURE_MISMATCH", message: "WhatsApp webhook signature did not match raw body." };
  }

  return { ok: true, value: true };
}

export function parseInboundMessages(raw: unknown, workspaceByPhoneNumberId: Record<string, string>): WhatsAppInboundMessage[] {
  const payload = raw as {
    entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; messages?: Array<Record<string, unknown>> } }> }>;
  };

  const messages: WhatsAppInboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const workspaceId = workspaceByPhoneNumberId[phoneNumberId];
      if (!workspaceId) continue;

      for (const message of change.value?.messages ?? []) {
        const id = String(message.id ?? "");
        const from = String(message.from ?? "");
        const timestamp = String(message.timestamp ?? "");
        const type = message.type === "text" || message.type === "image" ? message.type : "unsupported";
        const textBody = (message.text as { body?: string } | undefined)?.body;
        const mediaId = (message.image as { id?: string } | undefined)?.id;
        if (!id || !from) continue;
        messages.push({ workspaceId, phoneNumberId, providerMessageId: id, from, timestamp, type, text: textBody, mediaId });
      }
    }
  }
  return messages;
}

export function isInsideCustomerServiceWindow(lastInboundAt: string | undefined, now: string): boolean {
  if (!lastInboundAt) return false;
  const lastInboundMs = new Date(lastInboundAt).getTime();
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(lastInboundMs) || !Number.isFinite(nowMs)) return false;

  const elapsedMs = nowMs - lastInboundMs;
  return elapsedMs >= 0 && elapsedMs <= 24 * 60 * 60 * 1000;
}

export class FixtureWhatsAppAdapter implements MessagingAdapter {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async send(job: OutboxJob): Promise<Result<ProviderSendResult>> {
    const suppression = hasRecipientSuppression(job);
    if (suppression) return { ok: false, code: suppression, message: "WhatsApp send suppressed by recipient or handover policy." };

    const lastInboundAt = typeof job.payload.lastInboundAt === "string" ? job.payload.lastInboundAt : undefined;
    const insideWindow = isInsideCustomerServiceWindow(lastInboundAt, this.now());
    if (!insideWindow && !job.templateKey) {
      return { ok: false, code: "TEMPLATE_REQUIRED", message: "Approved WhatsApp template is required outside the customer-service window." };
    }

    return {
      ok: true,
      value: {
        jobId: job.id,
        providerMessageId: `wamid.fixture.${job.id}`,
        acceptedAt: this.now(),
        mode: "FIXTURE",
        evidence: {
          provider: "WHATSAPP",
          mode: "FIXTURE",
          verification: "CONTRACT_TESTED",
          capturedAt: this.now(),
          controlledId: `wamid.fixture.${job.id}`,
          notes: ["Fixture send only; controlled Meta receipt still required before PROVIDER_VERIFIED."],
        },
      },
    };
  }
}
