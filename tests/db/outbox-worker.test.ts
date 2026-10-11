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

  it("suppresses a queued campaign when consent is revoked before execution", async () => {
    const persisted: string[] = [];
    let providerCalls = 0;
    const repo: DurableOutboxRepository = {
      claimReady: async () => ({ ok: true, value: [{
        id: "campaign-queued",
        workspaceId: "ws_1",
        topic: "retention.campaign",
        payload: { campaignId: "campaign-1", customerId: "customer-1", channel: "EMAIL" },
        idempotencyKey: "campaign-queued",
        attempt: 1,
        claimedAt: now,
        lockedBy: "w",
      }] }),
      markSent: async (id) => { persisted.push(`${id}:sent`); return { ok: true, value: {} as never }; },
      markRetry: async (id, _worker, _failedAt, _next, _attempt, code) => { persisted.push(`${id}:retry:${code}`); return { ok: true, value: {} as never }; },
      markFailed: async (id, _worker, _failedAt, _attempt, code) => { persisted.push(`${id}:failed:${code}`); return { ok: true, value: {} as never }; },
      markSuppressed: async (id, _worker, _failedAt, _attempt, code) => { persisted.push(`${id}:suppressed:${code}`); return { ok: true, value: {} as never }; },
    };
    const executor: OutboxExecutionPort = {
      execute: async () => {
        providerCalls += 1;
        return { ok: true, value: { outcome: "SENT", completedAt: now, providerReference: "should-not-send" } };
      },
    };
    const guard = {
      check: async () => ({ ok: true as const, value: { allowed: false, code: "RECIPIENT_OPTED_OUT" } }),
    };

    await expect(runOutboxBatch({
      repository: repo,
      executor,
      guard,
      workerId: "w",
      now,
      leaseSeconds: 60,
      maxAttempts: 3,
      limit: 10,
    })).resolves.toMatchObject({
      ok: true,
      value: { claimed: 1, sent: 0, suppressed: 1 },
    });
    expect(providerCalls).toBe(0);
    expect(persisted).toEqual(["campaign-queued:suppressed:RECIPIENT_OPTED_OUT"]);
  });

  it("retries instead of sending when the execution-time guard is unavailable", async () => {
    const persisted: string[] = [];
    let providerCalls = 0;
    const repo: DurableOutboxRepository = {
      claimReady: async () => ({ ok: true, value: [{
        id: "campaign-guard-down",
        workspaceId: "ws_1",
        topic: "retention.campaign",
        payload: {},
        idempotencyKey: "campaign-guard-down",
        attempt: 1,
        claimedAt: now,
        lockedBy: "w",
      }] }),
      markSent: async (id) => { persisted.push(`${id}:sent`); return { ok: true, value: {} as never }; },
      markRetry: async (id, _worker, _failedAt, _next, _attempt, code) => { persisted.push(`${id}:retry:${code}`); return { ok: true, value: {} as never }; },
      markFailed: async (id, _worker, _failedAt, _attempt, code) => { persisted.push(`${id}:failed:${code}`); return { ok: true, value: {} as never }; },
      markSuppressed: async (id, _worker, _failedAt, _attempt, code) => { persisted.push(`${id}:suppressed:${code}`); return { ok: true, value: {} as never }; },
    };
    const executor: OutboxExecutionPort = {
      execute: async () => {
        providerCalls += 1;
        return { ok: true, value: { outcome: "SENT", completedAt: now } };
      },
    };
    const guard = {
      check: async () => ({ ok: false as const, code: "DB_UNAVAILABLE", message: "unavailable" }),
    };

    await runOutboxBatch({
      repository: repo,
      executor,
      guard,
      workerId: "w",
      now,
      leaseSeconds: 60,
      maxAttempts: 3,
      limit: 10,
    });
    expect(providerCalls).toBe(0);
    expect(persisted).toEqual(["campaign-guard-down:retry:OUTBOX_GUARD_ERROR"]);
  });


  it("rejects provider Retry-After values that overflow the supported clock without throwing", () => {
    const input = { event: { id: "overflow", attempt: 1 }, maxAttempts: 3,
      outcome: { outcome: "RETRYABLE_FAILURE" as const, failedAt: now,
        code: "HTTP_429", retryAfterSeconds: Number.MAX_SAFE_INTEGER } };
    expect(() => decideOutboxPersistence(input)).not.toThrow();
    expect(decideOutboxPersistence(input)).toMatchObject({
      ok: false, code: "OUTBOX_RETRY_SCHEDULE_INVALID",
    });
  });

  it("does not dispatch or persist a claimed row owned by a different worker", async () => {
    let calls = 0;
    const repository: DurableOutboxRepository = {
      claimReady: async () => ({ ok: true, value: [{
        id: "foreign-lease", workspaceId: "ws_1", topic: "quote.sent", payload: {},
        idempotencyKey: "foreign-lease", attempt: 1, claimedAt: now, lockedBy: "worker-b",
      }] }),
      markSent: async () => { calls++; return { ok: true, value: {} as never }; },
      markRetry: async () => { calls++; return { ok: true, value: {} as never }; },
      markFailed: async () => { calls++; return { ok: true, value: {} as never }; },
      markSuppressed: async () => { calls++; return { ok: true, value: {} as never }; },
    };
    const executor: OutboxExecutionPort = { execute: async () => {
      calls++; return { ok: true, value: { outcome: "SENT", completedAt: now } };
    } };
    const summary = await runOutboxBatch({
      repository, executor, workerId: "worker-a", now, leaseSeconds: 60, maxAttempts: 3, limit: 10,
    });
    expect(summary).toMatchObject({ ok: true, value: {
      claimed: 1, sent: 0, persistenceFailed: 1,
      items: [{ eventId: "foreign-lease", status: "PERSISTENCE_FAILED", code: "OUTBOX_LEASE_OWNER_MISMATCH" }],
    } });
    expect(calls).toBe(0);
  });

  it("isolates thrown persistence calls and still handles independent claimed jobs", async () => {
    const persisted: string[] = [];
    const claimed = ["first", "second", "third"].map(id => ({
      id, workspaceId: "ws_1", topic: "quote.sent", payload: {},
      idempotencyKey: id, attempt: 1, claimedAt: now, lockedBy: "worker-a",
    }));
    const repository: DurableOutboxRepository = {
      claimReady: async () => ({ ok: true, value: claimed }),
      markSent: async id => {
        if (id === "first") throw new Error("Bearer secret-token customer@example.test");
        persisted.push(id);
        return { ok: true, value: {} as never };
      },
      markRetry: async () => ({ ok: true, value: {} as never }),
      markFailed: async () => ({ ok: true, value: {} as never }),
      markSuppressed: async () => ({ ok: true, value: {} as never }),
    };
    const executor: OutboxExecutionPort = { execute: async () =>
      ({ ok: true, value: { outcome: "SENT", completedAt: now } }) };
    const result = await runOutboxBatch({
      repository, executor, workerId: "worker-a", now, leaseSeconds: 60, maxAttempts: 3, limit: 10,
    });
    expect(result).toMatchObject({ ok: true, value: {
      claimed: 3, sent: 2, persistenceFailed: 1,
      items: [{ eventId: "first", status: "PERSISTENCE_FAILED", code: "OUTBOX_PERSISTENCE_EXCEPTION" },
        { eventId: "second", status: "SENT" }, { eventId: "third", status: "SENT" }],
    } });
    expect(persisted).toEqual(["second", "third"]);
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("customer@example.test");
  });

  it("returns a redacted repository error when the initial claim throws", async () => {
    const repository: DurableOutboxRepository = {
      claimReady: async () => { throw new Error("Bearer extremely-private-token"); },
      markSent: async () => ({ ok: true, value: {} as never }),
      markRetry: async () => ({ ok: true, value: {} as never }),
      markFailed: async () => ({ ok: true, value: {} as never }),
      markSuppressed: async () => ({ ok: true, value: {} as never }),
    };
    const result = await runOutboxBatch({
      repository, executor: { execute: async () => { throw new Error("must not call"); } },
      workerId: "worker-a", now, leaseSeconds: 60, maxAttempts: 3, limit: 10,
    });
    expect(result).toMatchObject({ ok: false, code: "OUTBOX_PERSISTENCE_EXCEPTION" });
    expect(JSON.stringify(result)).not.toContain("extremely-private-token");
  });


  it("fails retention campaigns closed when the execution-time consent guard is not configured", async () => {
    const calls: string[] = [];
    const events = ["marketing", "quote"].map((id) => ({
      id,
      workspaceId: "ws-safe",
      topic: id === "marketing" ? "retention.campaign" : "quote.sent",
      payload: {}, idempotencyKey: id, attempt: 1, claimedAt: now, lockedBy: "worker-a",
    }));
    const repo: DurableOutboxRepository = {
      claimReady: async () => ({ ok: true, value: events }),
      markSent: async (id) => { calls.push(`persist:sent:${id}`); return { ok: true, value: {} as never }; },
      markRetry: async () => ({ ok: true, value: {} as never }),
      markFailed: async (id, _worker, _time, _attempt, code) => {
        calls.push(`persist:failed:${id}:${code}`);
        return { ok: true, value: {} as never };
      },
      markSuppressed: async () => ({ ok: true, value: {} as never }),
    };
    const executor: OutboxExecutionPort = { execute: async (event) => {
      calls.push(`provider:${event.id}`);
      return { ok: true, value: { outcome: "SENT", completedAt: now } };
    } };
    const result = await runOutboxBatch({
      repository: repo, executor, workerId: "worker-a", now,
      leaseSeconds: 60, maxAttempts: 3, limit: 10,
    });
    expect(result).toMatchObject({ ok: true, value: { claimed: 2, failed: 1, sent: 1,
      items: [{ eventId: "marketing", status: "FAILED", code: "OUTBOX_EXECUTION_GUARD_REQUIRED" },
        { eventId: "quote", status: "SENT" }],
    } });
    expect(calls).toEqual([
      "persist:failed:marketing:OUTBOX_EXECUTION_GUARD_REQUIRED",
      "provider:quote", "persist:sent:quote",
    ]);
  });
});
