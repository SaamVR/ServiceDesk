import { describe, expect, it } from "vitest";
import type { OutboxExecutionPort } from "../../src/contracts";
import type { DurableOutboxRepository } from "../../src/server/jobs/outbox-repository";
import { decideOutboxPersistence } from "../../src/server/jobs/outbox-retry";
import { runOutboxBatch } from "../../src/server/jobs/outbox-worker";

const now = "2026-10-04T06:00:00.000Z";

describe("outbox retry and worker behavior", () => {
  it("honors retryAfterSeconds as lower bound and max attempts as terminal failure", () => {
    expect(decideOutboxPersistence({ event: { id: "a", attempt: 1 }, maxAttempts: 3, outcome: { outcome: "RETRYABLE_FAILURE", failedAt: now, code: "HTTP_500", retryAfterSeconds: 10 } })).toMatchObject({ ok: true, value: { action: "markRetry", nextAttemptAt: "2026-10-04T06:01:00.000Z" } });
    expect(decideOutboxPersistence({ event: { id: "a", attempt: 1 }, maxAttempts: 3, outcome: { outcome: "RETRYABLE_FAILURE", failedAt: now, code: "RATE_LIMIT", retryAfterSeconds: 180 } })).toMatchObject({ ok: true, value: { action: "markRetry", nextAttemptAt: "2026-10-04T06:03:00.000Z" } });
    expect(decideOutboxPersistence({ event: { id: "a", attempt: 3 }, maxAttempts: 3, outcome: { outcome: "RETRYABLE_FAILURE", failedAt: now, code: "HTTP_500" } })).toMatchObject({ ok: true, value: { action: "markFailed" } });
  });

  it("continues after executor errors and persists each outcome", async () => {
    const persisted: string[] = [];
    const repo: DurableOutboxRepository = {
      claimReady: async () => ({ ok: true, value: [
        { id: "ok", workspaceId: "ws_1", topic: "a", payload: {}, idempotencyKey: "ok", attempt: 1, claimedAt: now, lockedBy: "w" },
        { id: "boom", workspaceId: "ws_1", topic: "b", payload: {}, idempotencyKey: "boom", attempt: 1, claimedAt: now, lockedBy: "w" },
      ] }),
      markSent: async (id) => { persisted.push(`${id}:sent`); return { ok: true, value: {} as never }; },
      markRetry: async (id, _worker, _failedAt, _next, _attempt, code) => { persisted.push(`${id}:retry:${code}`); return { ok: true, value: {} as never }; },
      markFailed: async (id, _worker, _failedAt, _attempt, code) => { persisted.push(`${id}:failed:${code}`); return { ok: true, value: {} as never }; },
      markSuppressed: async (id, _worker, _failedAt, _attempt, code) => { persisted.push(`${id}:suppressed:${code}`); return { ok: true, value: {} as never }; },
    };
    const executor: OutboxExecutionPort = {
      execute: async (event) => {
        if (event.id === "boom") throw new Error("temporary outage");
        return { ok: true, value: { outcome: "SENT", completedAt: now, providerReference: "provider-ok" } };
      },
    };

    await expect(runOutboxBatch({ repository: repo, executor, workerId: "w", now, leaseSeconds: 60, maxAttempts: 3, limit: 10 })).resolves.toMatchObject({ ok: true, value: { claimed: 2, sent: 1, retried: 1 } });
    expect(persisted).toEqual(["ok:sent", "boom:retry:OUTBOX_EXECUTOR_ERROR"]);
  });
});
