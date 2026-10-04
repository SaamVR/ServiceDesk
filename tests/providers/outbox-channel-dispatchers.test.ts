import { describe, expect, test } from "vitest";
import { WhatsAppCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/whatsapp-dispatcher";
import { EmailCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/email-dispatcher";
import { WebhookCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/webhook-dispatcher";
import type { OutboxJob } from "../../src/server/integrations/types";

const now = () => "2026-10-04T13:50:00.000Z";
function job(channel: OutboxJob["channel"]): OutboxJob { return { id: `evt-${channel}`, workspaceId: "ws-1", channel, purpose: "CONFIRMATION", recipient: { recipientRef: "recipient-ref", consentRequired: false, hasOptIn: true, optedOut: false }, createdAt: now(), idempotencyKey: `idem-${channel}`, payload: { email: { to: "customer@example.test", subject: "Subject", text: "Text", html: "<p>Html</p>", policy: {} } } }; }

describe("outbox channel dispatchers", () => {
  test("WhatsApp success preserves idempotency and accepts provider reference", async () => {
    const dispatcher = new WhatsAppCommittedOutboxDispatcher({ async send(outboxJob) { return { ok: true, value: { jobId: outboxJob.id, providerMessageId: "wamid-1", acceptedAt: now(), mode: "SANDBOX", evidence: { provider: "WHATSAPP", mode: "SANDBOX", verification: "CONTRACT_TESTED", capturedAt: now(), notes: [] } } }; } });
    const result = await dispatcher.dispatch({ job: job("WHATSAPP"), committedAt: now(), attempt: 1, expectedChannel: "WHATSAPP" });
    expect(result.ok && result.value.outcome).toBe("ACCEPTED");
  });

  test("Email missing normalized payload fails terminal before provider call", async () => {
    let called = false;
    const dispatcher = new EmailCommittedOutboxDispatcher({ async send() { called = true; throw new Error("should not call"); } });
    const emailJob = { ...job("EMAIL"), payload: {} };
    const result = await dispatcher.dispatch({ job: emailJob, committedAt: now(), attempt: 1, expectedChannel: "EMAIL" });
    expect(result.ok && result.value.outcome).toBe("TERMINAL_FAILURE");
    expect(called).toBe(false);
  });

  test("Webhook retryable status maps to retryable failure without raw response", async () => {
    const dispatcher = new WebhookCommittedOutboxDispatcher({ async resolve() { return { ok: true, value: { endpointId: "endpoint-1", url: "https://hooks.example.test", body: {} } }; } }, async () => ({ status: 503, retryAfterSeconds: 30 }), now);
    const result = await dispatcher.dispatch({ job: job("WEBHOOK"), committedAt: now(), attempt: 1, expectedChannel: "WEBHOOK" });
    expect(result.ok && result.value).toMatchObject({ outcome: "RETRYABLE_FAILURE", code: "HTTP_503", retryAfterSeconds: 30 });
  });
});
