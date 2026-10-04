import assert from "node:assert/strict";
import { ConnectorOutboxExecutionPort } from "../../src/server/integrations/outbox/execution-adapter";
import { WhatsAppCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/whatsapp-dispatcher";
import { EmailCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/email-dispatcher";
import { WebhookCommittedOutboxDispatcher } from "../../src/server/integrations/outbox/webhook-dispatcher";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";
import type { OutboxJob, RedactedProviderEvidence } from "../../src/server/integrations/types";
import type { TransactionalEmailAdapter, TransactionalEmailJob } from "../../src/server/integrations/email/adapter";

const now = () => "2026-10-04T13:50:00.000Z";
const evidence = (provider: RedactedProviderEvidence["provider"], id: string): RedactedProviderEvidence => ({ provider, mode: "SANDBOX", verification: "CONTRACT_TESTED", capturedAt: now(), controlledId: id, notes: ["redacted fixture evidence"] });

function event(channel: OutboxJob["channel"], id = `evt-${channel.toLowerCase()}`): ClaimedOutboxEvent {
  return { id, workspaceId: "ws-1", topic: `outbox.${channel.toLowerCase()}`, payload: {}, idempotencyKey: `idem-${id}`, attempt: 2, claimedAt: now() };
}

function job(channel: OutboxJob["channel"], id = `evt-${channel.toLowerCase()}`): OutboxJob {
  return {
    id,
    workspaceId: "ws-1",
    channel,
    purpose: channel === "EMAIL" ? "INVOICE" : "CONFIRMATION",
    recipient: { recipientRef: channel === "EMAIL" ? "customer@example.test" : "+15555550123", consentRequired: false, hasOptIn: true, optedOut: false },
    createdAt: now(),
    idempotencyKey: `idem-${id}`,
    payload: channel === "EMAIL" ? { email: { to: "customer@example.test", subject: "Invoice", text: "Plain summary", html: "<p>redacted</p>", policy: {} } } : { body: { ok: true } },
  };
}

async function main(): Promise<void> {
  let whatsappCalls = 0;
  const whatsapp = new WhatsAppCommittedOutboxDispatcher({
    async send(outboxJob) {
      whatsappCalls += 1;
      if (outboxJob.id === "evt-wa-retry") return { ok: false, code: "RATE_LIMITED", message: "Bearer sk_test_secret +15555550123" };
      if (outboxJob.id === "evt-wa-terminal") return { ok: false, code: "INVALID_RECIPIENT", message: "customer@example.test" };
      return { ok: true, value: { jobId: outboxJob.id, providerMessageId: `wamid.${outboxJob.id}`, acceptedAt: now(), mode: "SANDBOX", evidence: evidence("WHATSAPP", `wamid.${outboxJob.id}`) } };
    },
  });

  const emailAdapter: TransactionalEmailAdapter = {
    async send(emailJob: TransactionalEmailJob) {
      if (emailJob.to === "suppressed@example.test") return { ok: false, code: "RECIPIENT_HARD_BOUNCED", message: "raw email body should not appear <p>secret</p>" };
      return { ok: true, value: { idempotencyKey: emailJob.idempotencyKey, providerMessageId: `email.${emailJob.idempotencyKey}`, acceptedAt: now(), mode: "SANDBOX", evidence: evidence("EMAIL", `email.${emailJob.idempotencyKey}`) } };
    },
  };
  const email = new EmailCommittedOutboxDispatcher(emailAdapter);

  const webhook = new WebhookCommittedOutboxDispatcher(
    { async resolve(outboxJob) { return { ok: true, value: { endpointId: `endpoint-${outboxJob.id}`, url: "https://hooks.example.test/ingest", body: { event: outboxJob.id }, evidence: evidence("WEBHOOK", `endpoint-${outboxJob.id}`) } }; } },
    async (request) => {
      if (request.endpointId.includes("retry")) return { status: 503, retryAfterSeconds: 60 };
      if (request.endpointId.includes("terminal")) return { status: 403 };
      return { status: 202, providerMessageId: `hook.${request.idempotencyKey}`, acceptedAt: now() };
    },
    now,
  );

  const jobs = new Map<string, OutboxJob>();
  for (const candidate of [job("WHATSAPP"), job("EMAIL"), job("WEBHOOK"), job("WHATSAPP", "evt-wa-retry"), job("WHATSAPP", "evt-wa-terminal"), job("WEBHOOK", "evt-webhook-retry"), job("WEBHOOK", "evt-webhook-terminal")]) jobs.set(candidate.id, candidate);
  const suppressedEmail = job("EMAIL", "evt-email-suppressed");
  suppressedEmail.payload = { email: { to: "suppressed@example.test", subject: "Invoice", text: "Body", html: "<p>secret</p>", policy: {} } };
  jobs.set(suppressedEmail.id, suppressedEmail);

  const port = new ConnectorOutboxExecutionPort({
    now,
    dispatchers: { WHATSAPP: whatsapp, EMAIL: email, WEBHOOK: webhook },
    resolver: { async resolve(claim) { const resolved = jobs.get(claim.id); return resolved ? { ok: true, value: resolved } : { ok: false, code: "OUTBOX_INTENT_RESOLUTION_FAILED", message: "missing" }; } },
  });

  const wa = await port.execute(event("WHATSAPP"));
  assert.deepEqual(wa, { ok: true, value: { outcome: "SENT", completedAt: now(), providerReference: "wamid.evt-whatsapp" } });
  assert.equal(whatsappCalls, 1);

  const mail = await port.execute(event("EMAIL"));
  assert.equal(mail.ok && mail.value.outcome, "SENT");
  assert.equal(mail.ok && mail.value.providerReference, "email.idem-evt-email");

  const hook = await port.execute(event("WEBHOOK"));
  assert.equal(hook.ok && hook.value.outcome, "SENT");
  assert.equal(hook.ok && hook.value.providerReference, "hook.idem-evt-webhook");

  const retry = await port.execute(event("WHATSAPP", "evt-wa-retry"));
  assert.equal(retry.ok && retry.value.outcome, "RETRYABLE_FAILURE");
  assert.equal(retry.ok && retry.value.code, "RATE_LIMITED");
  assert.ok(JSON.stringify(retry).includes("RATE_LIMITED"));
  assert.ok(!JSON.stringify(retry).includes("sk_test_secret"));
  assert.ok(!JSON.stringify(retry).includes("+15555550123"));

  const terminal = await port.execute(event("WHATSAPP", "evt-wa-terminal"));
  assert.equal(terminal.ok && terminal.value.outcome, "TERMINAL_FAILURE");
  assert.ok(!JSON.stringify(terminal).includes("customer@example.test"));

  const suppressed = await port.execute(event("EMAIL", "evt-email-suppressed"));
  assert.equal(suppressed.ok && suppressed.value.outcome, "SUPPRESSED");
  assert.ok(!JSON.stringify(suppressed).includes("<p>secret</p>"));
  assert.ok(!JSON.stringify(suppressed).includes("suppressed@example.test"));

  const webhookRetry = await port.execute(event("WEBHOOK", "evt-webhook-retry"));
  assert.equal(webhookRetry.ok && webhookRetry.value.outcome, "RETRYABLE_FAILURE");
  assert.equal(webhookRetry.ok && webhookRetry.value.retryAfterSeconds, 60);

  const webhookTerminal = await port.execute(event("WEBHOOK", "evt-webhook-terminal"));
  assert.equal(webhookTerminal.ok && webhookTerminal.value.outcome, "TERMINAL_FAILURE");

  const mismatchJob = job("WHATSAPP", "evt-mismatch");
  mismatchJob.workspaceId = "ws-other";
  jobs.set("evt-mismatch", mismatchJob);
  const beforeMismatchCalls = whatsappCalls;
  const mismatch = await port.execute(event("WHATSAPP", "evt-mismatch"));
  assert.equal(mismatch.ok && mismatch.value.outcome, "TERMINAL_FAILURE");
  assert.equal(mismatch.ok && mismatch.value.code, "OUTBOX_INTENT_WORKSPACE_MISMATCH");
  assert.equal(whatsappCalls, beforeMismatchCalls);

  const missing = await port.execute(event("EMAIL", "evt-missing"));
  assert.equal(missing.ok && missing.value.outcome, "TERMINAL_FAILURE");
  assert.equal(missing.ok && missing.value.code, "OUTBOX_INTENT_RESOLUTION_FAILED");

  console.log("runtime-outage-outbox-execution-adapter-harness PASS");
}

void main();
