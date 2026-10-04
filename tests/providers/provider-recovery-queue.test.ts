import { describe, expect, test } from "vitest";
import { buildRecoveryQueueRecord } from "../../src/server/integrations/recovery/queue";
import { classifyProviderRecovery, type ProviderRecoveryEvent } from "../../src/server/integrations/recovery/policy";

function event(overrides: Partial<ProviderRecoveryEvent> = {}): ProviderRecoveryEvent {
  return {
    provider: "WHATSAPP",
    operation: "OUTBOUND_SEND",
    status: "TRANSIENT_FAILURE",
    attempts: 1,
    maxAttempts: 4,
    occurredAt: "2026-10-04T06:45:00.000Z",
    idempotencyKey: "idem-provider-1",
    redactedTarget: "recipient-ref-1",
    ...overrides,
  };
}

describe("provider recovery queue serialization", () => {
  test("serializes retry work with original idempotency key and scheduled attempt", () => {
    const source = event();
    const decision = classifyProviderRecovery(source);
    const record = buildRecoveryQueueRecord({
      workspaceId: "ws-clearnest",
      event: source,
      decision,
      queuedAt: "2026-10-04T06:46:00.000Z",
    });

    expect(record).toMatchObject({
      queue: "provider-retry",
      workspaceId: "ws-clearnest",
      provider: "WHATSAPP",
      action: "RETRY",
      idempotencyKey: "idem-provider-1",
      operatorVisible: false,
      mutatesBusinessTruth: false,
    });
    expect(record?.nextAttemptAt).toBe(decision.nextAttemptAt);
  });

  test("routes permanent failure to operator-visible dead letter without raw payload", () => {
    const source = event({ status: "PERMANENT_FAILURE" });
    const decision = classifyProviderRecovery(source);
    const record = buildRecoveryQueueRecord({
      workspaceId: "ws-clearnest",
      event: source,
      decision,
      queuedAt: "2026-10-04T06:46:00.000Z",
    });

    expect(record).toMatchObject({
      queue: "provider-dead-letter",
      action: "DEAD_LETTER",
      operatorVisible: true,
      redactedTarget: "recipient-ref-1",
    });
    expect(JSON.stringify(record)).not.toContain("rawPayload");
    expect(JSON.stringify(record)).not.toContain("secret");
  });

  test("routes exhausted retries to operator review", () => {
    const source = event({ attempts: 4, maxAttempts: 4 });
    const decision = classifyProviderRecovery(source);
    const record = buildRecoveryQueueRecord({
      workspaceId: "ws-clearnest",
      event: source,
      decision,
      queuedAt: "2026-10-04T06:46:00.000Z",
    });

    expect(record).toMatchObject({
      queue: "provider-operator-review",
      action: "OPERATOR_REVIEW",
      operatorVisible: true,
    });
  });

  test("routes stale state to reconciliation queue", () => {
    const source = event({ provider: "GOOGLE_CALENDAR", operation: "SYNC", status: "STALE_STATE" });
    const decision = classifyProviderRecovery(source);
    const record = buildRecoveryQueueRecord({
      workspaceId: "ws-clearnest",
      event: source,
      decision,
      queuedAt: "2026-10-04T06:46:00.000Z",
    });

    expect(record).toMatchObject({
      queue: "provider-reconciliation",
      provider: "GOOGLE_CALENDAR",
      action: "RECONCILE",
      operatorVisible: false,
    });
  });

  test("does not enqueue duplicate or stale callbacks that policy already acknowledges", () => {
    for (const status of ["DUPLICATE", "OUT_OF_ORDER"] as const) {
      const source = event({ status });
      const decision = classifyProviderRecovery(source);
      expect(
        buildRecoveryQueueRecord({
          workspaceId: "ws-clearnest",
          event: source,
          decision,
          queuedAt: "2026-10-04T06:46:00.000Z",
        }),
      ).toBeUndefined();
    }
  });
});
