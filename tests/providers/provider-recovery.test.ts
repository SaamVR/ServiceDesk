import { describe, expect, test } from "vitest";
import { classifyProviderRecovery, nextRecoveryAttemptAt, summarizeRecoveryQueue } from "../../src/server/integrations/recovery/policy";

describe("provider recovery policy", () => {
  test("retries transient WhatsApp and webhook failures with capped exponential backoff", () => {
    const whatsapp = classifyProviderRecovery({
      provider: "WHATSAPP",
      operation: "OUTBOUND_SEND",
      status: "TRANSIENT_FAILURE",
      attempts: 2,
      maxAttempts: 5,
      occurredAt: "2026-10-04T10:00:00.000Z",
      idempotencyKey: "wa-job-1",
    });
    const webhook = nextRecoveryAttemptAt("2026-10-04T10:00:00.000Z", 4);

    expect(whatsapp).toMatchObject({ action: "RETRY", retryable: true, terminal: false, preservesIdempotency: true });
    expect(webhook).toBe("2026-10-04T10:16:00.000Z");
  });

  test("does not retry permanent recipient or configuration failures", () => {
    const permanent = classifyProviderRecovery({
      provider: "EMAIL",
      operation: "OUTBOUND_SEND",
      status: "PERMANENT_FAILURE",
      attempts: 1,
      maxAttempts: 5,
      occurredAt: "2026-10-04T10:00:00.000Z",
      idempotencyKey: "email-job-1",
    });
    const config = classifyProviderRecovery({
      provider: "GOOGLE_CALENDAR",
      operation: "SYNC",
      status: "CONFIGURATION_BLOCKED",
      attempts: 0,
      maxAttempts: 5,
      occurredAt: "2026-10-04T10:00:00.000Z",
      idempotencyKey: "cal-sync-1",
    });

    expect(permanent).toMatchObject({ action: "DEAD_LETTER", retryable: false, terminal: true });
    expect(config).toMatchObject({ action: "BLOCKED_CONFIGURATION", retryable: false, terminal: true });
  });

  test("routes stale Calendar and out-of-order payment callbacks to reconciliation instead of mutation", () => {
    const calendar = classifyProviderRecovery({
      provider: "GOOGLE_CALENDAR",
      operation: "SYNC",
      status: "STALE_STATE",
      attempts: 1,
      maxAttempts: 5,
      occurredAt: "2026-10-04T10:00:00.000Z",
      idempotencyKey: "cal-sync-2",
    });
    const payment = classifyProviderRecovery({
      provider: "PAYMENT",
      operation: "CALLBACK_APPLY",
      status: "OUT_OF_ORDER",
      attempts: 1,
      maxAttempts: 5,
      occurredAt: "2026-10-04T10:00:00.000Z",
      idempotencyKey: "stripe-event-1",
    });

    expect(calendar).toMatchObject({ action: "RECONCILE", mutatesBusinessTruth: false });
    expect(payment).toMatchObject({ action: "IGNORE_STALE", mutatesBusinessTruth: false, terminal: true });
  });

  test("exhausted retries go to operator review with redacted summary", () => {
    const exhausted = classifyProviderRecovery({
      provider: "WEBHOOK",
      operation: "DELIVERY",
      status: "TRANSIENT_FAILURE",
      attempts: 5,
      maxAttempts: 5,
      occurredAt: "2026-10-04T10:00:00.000Z",
      idempotencyKey: "webhook-1",
      redactedTarget: "https://receiver.example/hooks/...",
    });

    expect(exhausted).toMatchObject({ action: "OPERATOR_REVIEW", retryable: false, terminal: true });
    expect(exhausted.notes.join(" ")).not.toContain("secret");
  });

  test("summarizes recovery queue without exposing PII or secrets", () => {
    const summary = summarizeRecoveryQueue([
      { provider: "WHATSAPP", action: "RETRY" },
      { provider: "PAYMENT", action: "IGNORE_STALE" },
      { provider: "WEBHOOK", action: "OPERATOR_REVIEW" },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.byProvider.WHATSAPP).toBe(1);
    expect(summary.byAction.OPERATOR_REVIEW).toBe(1);
  });
});
