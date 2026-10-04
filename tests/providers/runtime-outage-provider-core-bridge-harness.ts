import assert from "node:assert/strict";
import { dispatchCommittedOutboxJob } from "../../src/server/integrations/outbox/dispatch-router";
import { classifyProviderFailure } from "../../src/server/integrations/outbox/failure-policy";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher } from "../../src/server/integrations/outbox/dispatch-port";
import { verifiedPaymentEventForCore, verifiedPaymentWebhookEventCompatibility, E03_PAYMENT_APPLICATION_OUTCOME_DEPENDENCY } from "../../src/server/integrations/payments/verified-payment-compatibility";
import { createWhatsAppInboundCoreHandoffProcessor, toWhatsAppInboundBusinessCommandInput, type WhatsAppInboundBusinessCommandPort } from "../../src/server/integrations/whatsapp/inbound-core-handoff";
import type { OutboxJob, VerifiedPaymentWebhook } from "../../src/server/integrations/types";
import type { DurableWhatsAppInboxRecord } from "../../src/server/integrations/whatsapp/inbox-persistence";

function job(overrides: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: "outbox-1",
    workspaceId: "ws-1",
    channel: "WHATSAPP",
    purpose: "QUOTE",
    recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: true, optedOut: false },
    createdAt: "2026-10-04T12:00:00.000Z",
    idempotencyKey: "idem-1",
    payload: { body: "hello" },
    ...overrides,
  };
}

function record(overrides: Partial<DurableWhatsAppInboxRecord> = {}): DurableWhatsAppInboxRecord {
  return {
    provider: "WHATSAPP",
    workspaceId: "ws-1",
    providerAccountId: "phone-1",
    phoneNumberId: "phone-1",
    providerMessageId: "wamid-1",
    receiptKey: "ws-1:phone-1:wamid-1",
    senderRef: "15550000000",
    providerTimestamp: "1791108000",
    channel: "WHATSAPP",
    contentKind: "TEXT",
    text: "Need a quote",
    rawPayloadIncluded: false,
    aiAuthoritative: false,
    rawProviderEventRef: "raw-ref-1",
    ...overrides,
  };
}

async function main(): Promise<void> {
  const acceptedDispatcher: CommittedOutboxDispatcher = {
    async dispatch(input) {
      return {
        ok: true,
        value: {
          ...dispatchOutcomeBase(input.job),
          outcome: "ACCEPTED",
          providerMessageId: "wamid-provider-1",
          acceptedAt: input.committedAt,
          providerMode: "FIXTURE",
          evidence: {
            provider: input.job.channel,
            mode: "FIXTURE",
            verification: "CONTRACT_TESTED",
            capturedAt: input.committedAt,
            controlledId: "wamid-provider-1",
            notes: ["fixture dispatch"],
          },
        },
      };
    },
  };

  const routed = await dispatchCommittedOutboxJob({
    job: job(),
    committedAt: "2026-10-04T12:01:00.000Z",
    attempt: 1,
    expectedWorkspaceId: "ws-1",
    dispatchers: { WHATSAPP: acceptedDispatcher },
  });
  assert.equal(routed.ok, true);
  if (routed.ok) {
    assert.equal(routed.value.outcome, "ACCEPTED");
    assert.equal(routed.value.idempotencyKey, "idem-1");
    assert.equal(routed.value.workspaceId, "ws-1");
  }

  const suppressed = await dispatchCommittedOutboxJob({
    job: job({ recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: true, optedOut: true } }),
    committedAt: "2026-10-04T12:01:00.000Z",
    attempt: 1,
    dispatchers: { WHATSAPP: acceptedDispatcher },
  });
  assert.equal(suppressed.ok, true);
  if (suppressed.ok) assert.equal(suppressed.value.outcome, "SUPPRESSED");

  const mismatch = await dispatchCommittedOutboxJob({
    job: job(),
    committedAt: "2026-10-04T12:01:00.000Z",
    attempt: 1,
    expectedWorkspaceId: "other-ws",
    dispatchers: { WHATSAPP: acceptedDispatcher },
  });
  assert.equal(mismatch.ok, true);
  if (mismatch.ok) assert.equal(mismatch.value.outcome, "TERMINAL_FAILURE");

  const unsupported = await dispatchCommittedOutboxJob({
    job: job({ channel: "WEBHOOK" }),
    committedAt: "2026-10-04T12:01:00.000Z",
    attempt: 1,
    dispatchers: { WHATSAPP: acceptedDispatcher },
  });
  assert.equal(unsupported.ok, true);
  if (unsupported.ok) assert.equal(unsupported.value.outcome, "TERMINAL_FAILURE");

  assert.equal(classifyProviderFailure({ job: job(), code: "TIMEOUT", message: "provider timeout" }).outcome, "RETRYABLE_FAILURE");
  assert.equal(classifyProviderFailure({ job: job(), code: "RATE_LIMITED", message: "rate limit" }).outcome, "RETRYABLE_FAILURE");
  assert.equal(classifyProviderFailure({ job: job(), code: "AUTHENTICATION_FAILED", message: "bad key" }).outcome, "TERMINAL_FAILURE");
  assert.equal(classifyProviderFailure({ job: job(), code: "RECIPIENT_OPTED_OUT", message: "opted out" }).outcome, "SUPPRESSED");
  assert.equal(classifyProviderFailure({ job: job(), code: "NEW_UNKNOWN_PROVIDER_BLOB", message: "{\"secret\":\"raw\"}" }).outcome, "TERMINAL_FAILURE");

  assert.equal(verifiedPaymentWebhookEventCompatibility, true);
  const webhook: VerifiedPaymentWebhook = {
    event: {
      provider: "STRIPE",
      providerAccountId: "acct_1",
      providerEventId: "evt_1",
      providerTransactionId: "pi_1",
      purpose: "DEPOSIT",
      workspaceId: "ws-1",
      amountMinor: 1000,
      currency: "USD",
      occurredAt: "2026-10-04T12:02:00.000Z",
    },
    evidence: { provider: "PAYMENT", mode: "FIXTURE", verification: "CONTRACT_TESTED", capturedAt: "2026-10-04T12:02:00.000Z", notes: [] },
  };
  assert.deepEqual(verifiedPaymentEventForCore(webhook), webhook.event);
  assert.match(E03_PAYMENT_APPLICATION_OUTCOME_DEPENDENCY, /authoritative applied\/duplicate\/review/);

  const commandInputs: ReturnType<typeof toWhatsAppInboundBusinessCommandInput>[] = [];
  const command: WhatsAppInboundBusinessCommandPort = {
    async execute(input) {
      commandInputs.push(input);
      return input.receiptKey.endsWith("duplicate") ? { ok: true, value: "DUPLICATE" } : { ok: true, value: "APPLIED" };
    },
  };
  const processor = createWhatsAppInboundCoreHandoffProcessor(command);
  assert.equal(await processor.process(record()), "PROCESSED");
  assert.equal(commandInputs[0].receiptKey, "ws-1:phone-1:wamid-1");
  assert.equal(commandInputs[0].idempotencyKey, "ws-1:phone-1:wamid-1");
  assert.equal(commandInputs[0].text, "Need a quote");
  assert.equal(await processor.process(record({ receiptKey: "ws-1:phone-1:duplicate", providerMessageId: "duplicate" })), "DUPLICATE");
  const mediaInput = toWhatsAppInboundBusinessCommandInput(record({ contentKind: "MEDIA_REFERENCE", text: undefined, media: { provider: "WHATSAPP", providerMediaId: "media-1" } }));
  assert.equal(mediaInput.media?.providerMediaId, "media-1");
  const unsupportedInput = toWhatsAppInboundBusinessCommandInput(record({ contentKind: "UNSUPPORTED", text: undefined, media: undefined }));
  assert.equal(unsupportedInput.contentKind, "UNSUPPORTED");

  const failingProcessor = createWhatsAppInboundCoreHandoffProcessor({
    async execute() {
      return { ok: false, code: "CORE_COMMAND_RETRYABLE", message: "core unavailable" };
    },
  });
  await assert.rejects(() => failingProcessor.process(record()), /CORE_COMMAND_RETRYABLE/);

  console.log("runtime-outage-provider-core-bridge-harness PASS");
}

void main();
