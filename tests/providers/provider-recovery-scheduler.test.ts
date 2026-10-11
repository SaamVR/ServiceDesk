import { describe, expect, test } from "vitest";
import { planLeasedProviderRecoveryBatch, planProviderRecoveryBatch } from "../../src/server/integrations/recovery/scheduler";
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

  test("returns leased records and skips actively leased rows", () => {
    const batch = planLeasedProviderRecoveryBatch({
      now: "2026-10-04T07:15:00.000Z",
      workerId: "worker-a",
      maxItems: 2,
      records: [
        record({ idempotencyKey: "held", leasedBy: "worker-b", leaseExpiresAt: "2026-10-04T07:16:00.000Z" }),
        record({ idempotencyKey: "due-1" }),
        record({ idempotencyKey: "due-2" }),
      ],
    });

    expect(batch.ready.map((item) => item.idempotencyKey)).toEqual(["due-1", "due-2"]);
    expect(batch.ready.every((item) => item.leasedBy === "worker-a" && item.mutatesBusinessTruth === false)).toBe(true);
    expect(batch.skipped).toContainEqual({ idempotencyKey: "held", reason: "LEASED" });
  });

  test("prevents duplicate recovery replays within a single batch and maintains tenant separation", () => {
    const x = record({ idempotencyKey: "same-key", workspaceId: "tenant-a", queuedAt: "2026-10-04T07:01:00.000Z" });
    const older = record({ ...x, queuedAt: "2026-10-04T07:00:00.000Z" });
    const anotherTenant = record({ ...x, workspaceId: "tenant-b" });
    const rows = [x, older, anotherTenant];
    const regular = planProviderRecoveryBatch({ now: "2026-10-04T07:15:00.000Z", maxItems: 10, records: rows });
    expect(regular.ready).toHaveLength(2);
    expect(regular.duplicateSuppressed).toBe(1);
    expect(regular.ready.find(v => v.workspaceId === "tenant-a")?.queuedAt).toBe(older.queuedAt);

    const leased = planLeasedProviderRecoveryBatch({
      now: "2026-10-04T07:15:00.000Z", maxItems: 10, workerId: "worker-a", records: rows,
    });
    expect(leased.ready).toHaveLength(2);
    expect(leased.duplicateSuppressed).toBe(1);
    expect(new Set(leased.ready.map(v => v.workspaceId))).toEqual(new Set(["tenant-a", "tenant-b"]));
  });

  test("holds invalid schedule metadata for operator instead of losing provider work", () => {
    const broken = [
      record({ idempotencyKey: "invalid-due", nextAttemptAt: "not-a-date" }),
      record({ idempotencyKey: "invalid-queue", queuedAt: "not-a-date" }),
      record({ idempotencyKey: "missing-key", idempotencyKey: "" }),
      record({ idempotencyKey: "valid" }),
    ];
    const scheduled = planProviderRecoveryBatch({
      now: "2026-10-04T07:15:00.000Z", maxItems: 10, records: broken,
    });
    expect(scheduled.ready.map(v => v.idempotencyKey)).toEqual(["valid"]);
    expect(scheduled.heldForOperator).toBe(3);

    const invalidClock = planLeasedProviderRecoveryBatch({
      now: "bad-clock", maxItems: 10, workerId: "worker-a", records: broken,
    });
    expect(invalidClock.ready).toEqual([]);
    expect(invalidClock.heldForOperator).toBe(broken.length);
  });

  test("treats NaN, infinity and negative budgets as empty while preserving deferred accounting", () => {
    const records = [record({ idempotencyKey: "a" }), record({ idempotencyKey: "b" })];
    for (const limit of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
      const batch = planProviderRecoveryBatch({
        now: "2026-10-04T07:15:00.000Z", maxItems: limit, records,
      });
      expect(batch.ready).toEqual([]);
      expect(batch.deferred).toBe(2);
      const leased = planLeasedProviderRecoveryBatch({
        now: "2026-10-04T07:15:00.000Z", workerId: "worker-a", maxItems: limit, records,
      });
      expect(leased.ready).toEqual([]);
      expect(leased.deferred).toBe(2);
    }
  });

});
