import assert from "node:assert/strict";
import { resolveAuthoritativeEmailOutboxIntent } from "../../src/server/integrations/outbox/email-intent";
import { createEmailCallbackReceiptStore } from "../../src/server/integrations/email/callback-receipt";
import { buildEmailCallbackCommands, processEmailProviderCallback } from "../../src/server/integrations/email/callback-bridge";
import { AuthoritativeWebhookDeliveryIntentResolver } from "../../src/server/integrations/webhook/authoritative-destination";
import { buildWebhookOperationalReceipt } from "../../src/server/integrations/webhook/operational-receipt";
import { buildOperationalProviderReadinessReport } from "../../src/server/integrations/provider-readiness";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";
import type { OutboxJob } from "../../src/server/integrations/types";

async function run() {
  const claimedEmail: ClaimedOutboxEvent = {
    id: "email-outbox-1",
    workspaceId: "ws-1",
    topic: "email.quote",
    payload: { to: "attacker@example.test", subject: "untrusted" },
    idempotencyKey: "idem-email-1",
    attempt: 1,
    claimedAt: "2026-10-04T17:40:00.000Z",
  };

  const emailJob = await resolveAuthoritativeEmailOutboxIntent(claimedEmail, {
    async resolve(event) {
      return {
        ok: true,
        value: {
          eventId: event.id,
          workspaceId: event.workspaceId,
          topic: "email.quote",
          purpose: "QUOTE",
          idempotencyKey: event.idempotencyKey,
          recipient: { recipientRef: "customer-1", to: "customer@example.com", consentRequired: true, hasOptIn: true, optedOut: false },
          subject: "Quote ready",
          text: "Your quote is ready.",
          html: "<p>Your quote is ready.</p>",
        },
      };
    },
  });
  assert.equal(emailJob.ok, true);
  assert.equal((emailJob as any).value.payload.email.to, "customer@example.com");
  assert.equal(JSON.stringify(emailJob).includes("attacker@example.test"), false);

  const delivered = buildEmailCallbackCommands(undefined, {
    callbackKey: "cb-delivered",
    providerMessageId: "email-provider-1",
    eventType: "DELIVERED",
    occurredAt: "2026-10-04T17:41:00.000Z",
    recipientRef: "customer@example.com",
  });
  assert.equal(delivered.deliveryCommand?.deliveryState, "DELIVERED");
  assert.equal(delivered.deliveryCommand?.providerAcceptedIsDelivered, false);

  const soft = buildEmailCallbackCommands(undefined, {
    callbackKey: "cb-soft",
    providerMessageId: "email-provider-1",
    eventType: "BOUNCE",
    bounceType: "soft",
    occurredAt: "2026-10-04T17:42:00.000Z",
    recipientRef: "customer@example.com",
  });
  assert.equal(soft.deliveryCommand?.deliveryState, "RETRYABLE_FAILURE");

  const hard = buildEmailCallbackCommands(undefined, {
    callbackKey: "cb-hard",
    providerMessageId: "email-provider-1",
    eventType: "BOUNCE",
    bounceType: "hard",
    occurredAt: "2026-10-04T17:43:00.000Z",
    recipientRef: "customer@example.com",
  });
  assert.equal(hard.suppressionCommand?.reason, "HARD_BOUNCE");

  const complaint = buildEmailCallbackCommands(undefined, {
    callbackKey: "cb-complaint",
    providerMessageId: "email-provider-1",
    eventType: "COMPLAINT",
    occurredAt: "2026-10-04T17:44:00.000Z",
    recipientRef: "customer@example.com",
  });
  assert.equal(complaint.suppressionCommand?.reason, "COMPLAINT");

  const receiptStore = createEmailCallbackReceiptStore({
    async insertReceipt(row) {
      assert.equal("rawBody" in row, false);
      assert.equal(row.redactedRecipientRef.includes("customer@example.com"), false);
      return "DUPLICATE";
    },
  });
  let coreDeliveryCalls = 0;
  const processed = await processEmailProviderCallback({
    receiptStore,
    event: {
      callbackKey: "cb-dup-after-failure",
      providerMessageId: "email-provider-2",
      eventType: "DELIVERED",
      occurredAt: "2026-10-04T17:45:00.000Z",
      recipientRef: "customer@example.com",
    },
    core: {
      async applyDeliveryState(command) { coreDeliveryCalls += 1; assert.equal(command.deliveryState, "DELIVERED"); return { ok: true, value: "APPLIED" }; },
      async applySuppressionReview() { return { ok: true, value: "APPLIED" }; },
    },
  });
  assert.equal(processed.ok, true);
  assert.equal((processed as any).value.receipt, "DUPLICATE");
  assert.equal(coreDeliveryCalls, 1);

  const webhookJob: OutboxJob = {
    id: "webhook-outbox-1",
    workspaceId: "ws-1",
    channel: "WEBHOOK",
    purpose: "STAFF_ALERT",
    recipient: { recipientRef: "webhook:endpoint-1", consentRequired: false, hasOptIn: true, optedOut: false },
    createdAt: "2026-10-04T17:46:00.000Z",
    idempotencyKey: "idem-webhook-1",
    payload: { url: "https://evil.example/hook", signingSecret: "do-not-trust" },
  };
  const webhookResolver = new AuthoritativeWebhookDeliveryIntentResolver({
    async resolve() {
      return {
        ok: true,
        value: {
          endpointId: "endpoint-1",
          workflowId: "n8n-workflow-1",
          url: "https://hooks.example.com/service",
          allowedHost: "hooks.example.com",
          signingSecretRef: "secret-ref-1",
          signingSecret: "controlled-secret",
          body: { type: "quote.updated" },
        },
      };
    },
  });
  const webhookIntent = await webhookResolver.resolve(webhookJob);
  assert.equal(webhookIntent.ok, true);
  assert.equal((webhookIntent as any).value.url, "https://hooks.example.com/service");
  assert.equal(JSON.stringify(webhookIntent).includes("controlled-secret"), false);
  assert.equal(JSON.stringify(webhookIntent).includes("do-not-trust"), false);

  assert.equal(buildWebhookOperationalReceipt({ receiptKey: "wr-1", endpointId: "endpoint-1", workflowId: "n8n-workflow-1", providerMessageId: "wh-1", status: 200, occurredAt: "2026-10-04T17:47:00.000Z" }).state, "DELIVERED");
  assert.equal(buildWebhookOperationalReceipt({ receiptKey: "wr-2", endpointId: "endpoint-1", providerMessageId: "wh-2", status: 429, occurredAt: "2026-10-04T17:47:00.000Z" }).action, "E04_RETRY");
  assert.equal(buildWebhookOperationalReceipt({ receiptKey: "wr-3", endpointId: "endpoint-1", providerMessageId: "wh-3", status: 503, occurredAt: "2026-10-04T17:47:00.000Z" }).action, "E04_RETRY");
  assert.equal(buildWebhookOperationalReceipt({ receiptKey: "wr-4", endpointId: "endpoint-1", providerMessageId: "wh-4", status: 404, occurredAt: "2026-10-04T17:47:00.000Z", responseExcerpt: "email customer@example.com token=secret" }).action, "ATTENTION_REVIEW");
  const pending = buildWebhookOperationalReceipt({ receiptKey: "wr-5", endpointId: "endpoint-1", workflowId: "n8n-workflow-1", providerMessageId: "wh-5", status: 202, n8nState: "PENDING", occurredAt: "2026-10-04T17:47:00.000Z" });
  assert.equal(pending.state, "N8N_PENDING");
  assert.equal(pending.terminal, false);

  const readiness = buildOperationalProviderReadinessReport("2026-10-04T17:48:00.000Z");
  assert.equal(readiness.liveProviderGate, "MULTIPLE_REQUIRED");
  assert.equal(JSON.stringify({ emailJob, delivered, soft, hard, complaint, processed, webhookIntent, pending, readiness }).includes("controlled-secret"), false);
  assert.equal(JSON.stringify({ hard, pending }).includes("customer@example.com"), false);

  console.log("runtime-outage-e08-email-webhook-operational-harness PASS");
}

void run();
