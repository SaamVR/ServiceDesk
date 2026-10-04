import { describe, expect, test } from "vitest";
import { planProviderRecoveryLease } from "../../src/server/integrations/recovery/lease";

describe("provider recovery lease policy", () => {
  test("claims an unleased recovery item for a bounded interval", () => {
    const decision = planProviderRecoveryLease({
      workspaceId: "ws-clearnest",
      idempotencyKey: "idem-1",
      workerId: "worker-a",
      now: "2026-10-04T07:30:00.000Z",
      leaseDurationSeconds: 90,
    });

    expect(decision).toMatchObject({
      action: "CLAIM",
      holder: "worker-a",
      canExecute: true,
      mutatesBusinessTruth: false,
    });
    expect(decision.leaseExpiresAt).toBe("2026-10-04T07:31:30.000Z");
  });

  test("does not steal an active lease from another worker", () => {
    const decision = planProviderRecoveryLease({
      workspaceId: "ws-clearnest",
      idempotencyKey: "idem-1",
      workerId: "worker-b",
      now: "2026-10-04T07:30:00.000Z",
      leaseOwner: "worker-a",
      leaseExpiresAt: "2026-10-04T07:31:00.000Z",
    });

    expect(decision).toMatchObject({
      action: "HELD",
      holder: "worker-a",
      canExecute: false,
      leaseExpiresAt: "2026-10-04T07:31:00.000Z",
    });
  });

  test("renews the current worker lease and allows takeover only after expiry", () => {
    const renew = planProviderRecoveryLease({
      workspaceId: "ws-clearnest",
      idempotencyKey: "idem-1",
      workerId: "worker-a",
      now: "2026-10-04T07:30:00.000Z",
      leaseOwner: "worker-a",
      leaseExpiresAt: "2026-10-04T07:30:30.000Z",
      leaseDurationSeconds: 120,
    });
    expect(renew.action).toBe("RENEW");
    expect(renew.canExecute).toBe(true);

    const takeover = planProviderRecoveryLease({
      workspaceId: "ws-clearnest",
      idempotencyKey: "idem-1",
      workerId: "worker-b",
      now: "2026-10-04T07:31:00.000Z",
      leaseOwner: "worker-a",
      leaseExpiresAt: "2026-10-04T07:30:30.000Z",
      leaseDurationSeconds: 60,
    });
    expect(takeover.action).toBe("CLAIM");
    expect(takeover.holder).toBe("worker-b");
    expect(takeover.canExecute).toBe(true);
  });

  test("clamps lease duration to a safe operational window", () => {
    const short = planProviderRecoveryLease({
      workspaceId: "ws-clearnest",
      idempotencyKey: "idem-1",
      workerId: "worker-a",
      now: "2026-10-04T07:30:00.000Z",
      leaseDurationSeconds: 1,
    });
    const long = planProviderRecoveryLease({
      workspaceId: "ws-clearnest",
      idempotencyKey: "idem-2",
      workerId: "worker-a",
      now: "2026-10-04T07:30:00.000Z",
      leaseDurationSeconds: 9999,
    });

    expect(short.leaseExpiresAt).toBe("2026-10-04T07:30:30.000Z");
    expect(long.leaseExpiresAt).toBe("2026-10-04T07:35:00.000Z");
  });
});
