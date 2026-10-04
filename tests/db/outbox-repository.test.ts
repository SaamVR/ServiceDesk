import { describe, expect, it } from "vitest";
import type { DurableOutboxTableGateway, DurableOutboxRow } from "../../src/server/jobs/outbox-repository";
import { createDurableOutboxRepository } from "../../src/server/jobs/outbox-repository";

const row: DurableOutboxRow = {
  id: "outbox_1",
  workspaceId: "ws_1",
  topic: "booking.confirmed",
  payload: { visitId: "visit_1" },
  status: "PENDING",
  attempts: 1,
  idempotencyKey: "visit_1:booking",
  lockedAt: "2026-10-04T06:00:00.000Z",
  lockedBy: "worker-a",
  createdAt: "2026-10-04T05:59:00.000Z",
  updatedAt: "2026-10-04T06:00:00.000Z",
};

describe("durable outbox repository", () => {
  it("maps claimed rows to frozen ClaimedOutboxEvent shape", async () => {
    const gateway: DurableOutboxTableGateway = {
      claimReady: async () => ({ data: [row], error: null }),
      markSent: async () => ({ data: null, error: null }),
      markRetry: async () => ({ data: null, error: null }),
      markFailed: async () => ({ data: null, error: null }),
      markSuppressed: async () => ({ data: null, error: null }),
    };
    const repo = createDurableOutboxRepository(gateway);
    await expect(repo.claimReady("worker-a", row.lockedAt!, 60, 10)).resolves.toEqual({
      ok: true,
      value: [{ id: "outbox_1", workspaceId: "ws_1", topic: "booking.confirmed", payload: { visitId: "visit_1" }, idempotencyKey: "visit_1:booking", attempt: 1, claimedAt: row.lockedAt, lockedBy: "worker-a" }],
    });
  });

  it("fails closed for invalid claim configuration", async () => {
    const gateway = {} as DurableOutboxTableGateway;
    const repo = createDurableOutboxRepository(gateway);
    await expect(repo.claimReady("", row.lockedAt!, 60, 10)).resolves.toMatchObject({ ok: false, code: "OUTBOX_WORKER_ID_REQUIRED" });
    await expect(repo.claimReady("worker-a", row.lockedAt!, 0, 10)).resolves.toMatchObject({ ok: false, code: "OUTBOX_CLAIM_CONFIG_INVALID" });
  });

  it("requires lease owner for completion methods", async () => {
    const gateway: DurableOutboxTableGateway = {
      claimReady: async () => ({ data: [], error: null }),
      markSent: async () => ({ data: null, error: null }),
      markRetry: async () => ({ data: null, error: null }),
      markFailed: async () => ({ data: null, error: null }),
      markSuppressed: async () => ({ data: null, error: null }),
    };
    const repo = createDurableOutboxRepository(gateway);
    await expect(repo.markSent("outbox_1", "worker-stale", row.lockedAt!, "provider_1")).resolves.toMatchObject({ ok: false, code: "OUTBOX_ROW_NOT_FOUND" });
  });
});
