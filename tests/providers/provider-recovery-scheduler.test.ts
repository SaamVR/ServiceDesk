import { describe, expect, test } from "vitest";
import { planProviderRecoveryBatch } from "../../src/server/integrations/recovery/scheduler";
import type { ProviderRecoveryQueueRecord } from "../../src/server/integrations/recovery/queue";

function record(overrides: Partial<ProviderRecoveryQueueRecord> = {}): ProviderRecoveryQueueRecord {
  return {
    queue: "provider-retry",
    workspaceId: "ws-clearnest",
    provider: "WHATSAPP",
    operation: "DELIVERY",
    action: "RETRY",
    idempotencyKey: "idem-1",
    attempts: 1,
    maxAttempts: 4,
    queuedAt: "2026-10-04T07:00:00.000Z",
    occurredAt: "2026-10-04T06:59:00.000Z",
    nextAttemptAt: "2026-10-04T07:10:00.000Z",
    operatorVisible: false,
    mutatesBusinessTruth: false,
    notes: [],
    ...overrides,
  };
}

describe("provider recovery scheduler", () => {
  test("selects only due retry and reconciliation work", () => {
    const batch = planProviderRecoveryBatch({
      now: "2026-10-04T07:15:00.000Z",
      maxItems: 10,
      records: [
        record({ idempotencyKey: "due", nextAttemptAt: "2026-10-04T07:10:00.000Z" }),
        record({ idempotencyKey: "future", nextAttemptAt: "2026-10-04T07:20:00.000Z" }),
        record({ idempotencyKey: "reconcile", queue: "provider-reconciliation", action: "RECONCILE", nextAttemptAt: undefined }),
      ],
    });

    expect(batch.ready.map((item) => item.idempotencyKey)).toEqual(["reconcile", "due"]);
    expect(batch.deferred).toBe(1);
  });

  test("never auto-schedules operator, dead-letter, or configuration-blocked queues", () => {
    const batch = planProviderRecoveryBatch({
      now: "2026-10-04T07:15:00.000Z",
      maxItems: 10,
      records: [
        record({ queue: "provider-operator-review", action: "OPERATOR_REVIEW", operatorVisible: true }),
        record({ queue: "provider-dead-letter", action: "DEAD_LETTER", operatorVisible: true }),
        record({ queue: "provider-configuration-blocked", action: "BLOCKED_CONFIGURATION", operatorVisible: true }),
      ],
    });

    expect(batch.ready).toHaveLength(0);
    expect(batch.heldForOperator).toBe(3);
  });

  test("uses deterministic ordering and preserves original records", () => {
    const first = record({ idempotencyKey: "b", queuedAt: "2026-10-04T07:02:00.000Z", nextAttemptAt: "2026-10-04T07:10:00.000Z" });
    const second = record({ idempotencyKey: "a", queuedAt: "2026-10-04T07:01:00.000Z", nextAttemptAt: "2026-10-04T07:10:00.000Z" });
    const batch = planProviderRecoveryBatch({
      now: "2026-10-04T07:15:00.000Z",
      maxItems: 1,
      records: [first, second],
    });

    expect(batch.ready).toHaveLength(1);
    expect(batch.ready[0].idempotencyKey).toBe("a");
    expect(batch.ready[0].mutatesBusinessTruth).toBe(false);
    expect(batch.deferred).toBe(1);
  });
});
