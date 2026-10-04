import { describe, expect, test } from "vitest";
import { buildProviderRecoveryReceipt, summarizeProviderRecoveryReceipts } from "../../src/server/integrations/recovery/receipt";

describe("provider recovery attempt receipt", () => {
  test("records successful recovery without mutating business truth or upgrading provider proof", () => {
    const receipt = buildProviderRecoveryReceipt({
      workspaceId: "ws-clearnest",
      provider: "WHATSAPP",
      operation: "DELIVERY",
      disposition: "COMPLETE",
      outcome: "SUCCESS",
      idempotencyKey: "msg-1",
      attemptNumber: 2,
      attemptedAt: "2026-10-04T07:15:00.000Z",
      verification: "CONTRACT_TESTED",
      controlledReceiptRef: "wamid.redacted.1",
    });

    expect(receipt).toMatchObject({
      workspaceId: "ws-clearnest",
      provider: "WHATSAPP",
      disposition: "COMPLETE",
      terminal: true,
      operatorActionRequired: false,
      mutatesBusinessTruth: false,
      verification: "CONTRACT_TESTED",
    });
  });

  test("keeps retry receipts non-terminal with a redacted next-attempt timestamp", () => {
    const receipt = buildProviderRecoveryReceipt({
      workspaceId: "ws-clearnest",
      provider: "WEBHOOK",
      operation: "DELIVERY",
      disposition: "REQUEUE",
      outcome: "TRANSIENT_FAILURE",
      idempotencyKey: "webhook-1",
      attemptNumber: 1,
      attemptedAt: "2026-10-04T07:15:00.000Z",
      nextAttemptAt: "2026-10-04T07:19:00.000Z",
      verification: "CONFIGURATION_BLOCKED",
    });

    expect(receipt).toMatchObject({
      terminal: false,
      operatorActionRequired: false,
      nextAttemptAt: "2026-10-04T07:19:00.000Z",
      verification: "CONFIGURATION_BLOCKED",
    });
  });

  test("marks operator-review and dead-letter dispositions as operator visible", () => {
    const review = buildProviderRecoveryReceipt({
      workspaceId: "ws-clearnest",
      provider: "PAYMENT",
      operation: "CALLBACK_APPLY",
      disposition: "OPERATOR_REVIEW",
      outcome: "TRANSIENT_FAILURE",
      idempotencyKey: "evt-1",
      attemptNumber: 4,
      attemptedAt: "2026-10-04T07:20:00.000Z",
      verification: "CONTRACT_TESTED",
    });

    const deadLetter = buildProviderRecoveryReceipt({
      workspaceId: "ws-clearnest",
      provider: "EMAIL",
      operation: "DELIVERY",
      disposition: "DEAD_LETTER",
      outcome: "PERMANENT_FAILURE",
      idempotencyKey: "email-1",
      attemptNumber: 1,
      attemptedAt: "2026-10-04T07:20:00.000Z",
      verification: "CONTRACT_TESTED",
    });

    expect(review.operatorActionRequired).toBe(true);
    expect(deadLetter.operatorActionRequired).toBe(true);
    expect(review.terminal).toBe(true);
    expect(deadLetter.terminal).toBe(true);
  });

  test("summarizes recovery receipts without exposing idempotency keys or provider payloads", () => {
    const receipts = [
      buildProviderRecoveryReceipt({
        workspaceId: "ws-clearnest",
        provider: "WHATSAPP",
        operation: "DELIVERY",
        disposition: "COMPLETE",
        outcome: "SUCCESS",
        idempotencyKey: "secret-logical-key",
        attemptNumber: 1,
        attemptedAt: "2026-10-04T07:20:00.000Z",
        verification: "CONTRACT_TESTED",
      }),
      buildProviderRecoveryReceipt({
        workspaceId: "ws-clearnest",
        provider: "PAYMENT",
        operation: "CALLBACK_APPLY",
        disposition: "OPERATOR_REVIEW",
        outcome: "TRANSIENT_FAILURE",
        idempotencyKey: "evt-secret",
        attemptNumber: 4,
        attemptedAt: "2026-10-04T07:20:00.000Z",
        verification: "CONTRACT_TESTED",
      }),
    ];

    const summary = summarizeProviderRecoveryReceipts(receipts);
    expect(summary).toEqual({
      total: 2,
      terminal: 2,
      operatorActionRequired: 1,
      byProvider: { WHATSAPP: 1, PAYMENT: 1 },
      byVerification: { CONTRACT_TESTED: 2 },
    });
    expect(JSON.stringify(summary)).not.toContain("secret-logical-key");
    expect(JSON.stringify(summary)).not.toContain("evt-secret");
  });
});
