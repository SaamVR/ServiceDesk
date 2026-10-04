import { describe, expect, test } from "vitest";
import { applyRecoveryAttemptResult } from "../../src/server/integrations/recovery/executor";
import type { ProviderRecoveryQueueRecord } from "../../src/server/integrations/recovery/queue";

function record(overrides: Partial<ProviderRecoveryQueueRecord> = {}): ProviderRecoveryQueueRecord {
  return {
    queue: "provider-retry",
    workspaceId: "ws-clearnest",
    provider: "WHATSAPP",
    operation: "OUTBOUND_SEND",
    action: "RETRY",
    idempotencyKey: "idem-retry-1",
    attempts: 1,
    maxAttempts: 3,
    queuedAt: "2026-10-04T06:50:00.000Z",
    occurredAt: "2026-10-04T06:45:00.000Z",
    nextAttemptAt: "2026-10-04T06:54:00.000Z",
    redactedTarget: "recipient-ref-1",
    operatorVisible: false,
    mutatesBusinessTruth: false,
    notes: [],
    ...overrides,
  };
}

describe("provider recovery attempt transitions", () => {
  test("completes retry work after successful controlled provider attempt", () => {
    expect(
      applyRecoveryAttemptResult({
        record: record(),
        outcome: "SUCCESS",
        attemptedAt: "2026-10-04T06:54:00.000Z",
      }),
    ).toMatchObject({ disposition: "COMPLETE", enqueue: false, mutatesBusinessTruth: false });
  });

  test("requeues transient failure with incremented attempts and same idempotency key", () => {
    const result = applyRecoveryAttemptResult({
      record: record(),
      outcome: "TRANSIENT_FAILURE",
      attemptedAt: "2026-10-04T06:54:00.000Z",
    });

    expect(result).toMatchObject({
      disposition: "REQUEUE",
      enqueue: true,
      record: { attempts: 2, idempotencyKey: "idem-retry-1", queue: "provider-retry" },
    });
    expect(result.record?.nextAttemptAt).not.toBe("2026-10-04T06:54:00.000Z");
  });

  test("escalates exhausted retry budget to operator review", () => {
    const result = applyRecoveryAttemptResult({
      record: record({ attempts: 3, maxAttempts: 3 }),
      outcome: "TRANSIENT_FAILURE",
      attemptedAt: "2026-10-04T06:54:00.000Z",
    });

    expect(result).toMatchObject({
      disposition: "OPERATOR_REVIEW",
      enqueue: true,
      record: { queue: "provider-operator-review", operatorVisible: true },
    });
  });

  test("moves permanent provider failure to dead letter", () => {
    const result = applyRecoveryAttemptResult({
      record: record(),
      outcome: "PERMANENT_FAILURE",
      attemptedAt: "2026-10-04T06:54:00.000Z",
    });

    expect(result).toMatchObject({
      disposition: "DEAD_LETTER",
      enqueue: true,
      record: { queue: "provider-dead-letter", operatorVisible: true },
    });
  });

  test("moves invalid configuration to blocked configuration queue", () => {
    const result = applyRecoveryAttemptResult({
      record: record(),
      outcome: "CONFIGURATION_BLOCKED",
      attemptedAt: "2026-10-04T06:54:00.000Z",
    });

    expect(result).toMatchObject({
      disposition: "BLOCKED_CONFIGURATION",
      enqueue: true,
      record: { queue: "provider-configuration-blocked", operatorVisible: true },
    });
  });
});
