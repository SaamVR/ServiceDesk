import assert from "node:assert/strict";
import type { ClaimedOutboxEvent, OutboxExecutionPort, OutboxExecutionOutcome, Result } from "../../src/contracts";
import type { DurableOutboxRepository, DurableOutboxRow } from "../../src/server/jobs/outbox-repository";
import { claimedOutboxEventFromRow } from "../../src/server/jobs/outbox-repository";
import { decideOutboxPersistence, minimumBackoffSeconds } from "../../src/server/jobs/outbox-retry";
import { runOutboxBatch } from "../../src/server/jobs/outbox-worker";

const t0 = "2026-10-04T06:00:00.000Z";
const t30 = "2026-10-04T06:00:30.000Z";
const t61 = "2026-10-04T06:01:01.000Z";

function plusSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

function row(id: string, overrides: Partial<DurableOutboxRow> = {}): DurableOutboxRow {
  return {
    id,
    workspaceId: "ws_1",
    topic: "booking.confirmed",
    payload: { id },
    status: "PENDING",
    attempts: 0,
    idempotencyKey: `idem_${id}`,
    createdAt: t0,
    updatedAt: t0,
    ...overrides,
  };
}

class InMemoryOutboxRepository implements DurableOutboxRepository {
  rows = new Map<string, DurableOutboxRow>();

  constructor(rows: DurableOutboxRow[]) {
    for (const item of rows) this.rows.set(item.id, { ...item, payload: { ...item.payload } });
  }

  async claimReady(workerId: string, now: string, leaseSeconds: number, limit: number): Promise<Result<ReturnType<typeof claimedOutboxEventFromRow>[]>> {
    const nowMs = new Date(now).getTime();
    const claimed: DurableOutboxRow[] = [];
    for (const item of Array.from(this.rows.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (claimed.length >= limit) break;
      if (item.status !== "PENDING") continue;
      if (item.nextAttemptAt && new Date(item.nextAttemptAt).getTime() > nowMs) continue;
      const lockedAt = item.lockedAt ? new Date(item.lockedAt).getTime() : undefined;
      const lockActive = item.lockedBy && lockedAt !== undefined && lockedAt + leaseSeconds * 1000 > nowMs;
      if (lockActive) continue;
      item.lockedBy = workerId;
      item.lockedAt = now;
      item.attempts += 1;
      item.updatedAt = now;
      claimed.push(item);
    }
    return { ok: true, value: claimed.map((item) => claimedOutboxEventFromRow(item, workerId)) };
  }

  private leased(eventId: string, workerId: string): DurableOutboxRow | undefined {
    const item = this.rows.get(eventId);
    if (!item || item.status !== "PENDING" || item.lockedBy !== workerId) return undefined;
    return item;
  }

  async markSent(eventId: string, workerId: string, completedAt: string, providerReference?: string): Promise<Result<DurableOutboxRow>> {
    const item = this.leased(eventId, workerId);
    if (!item) return { ok: false, code: "LEASE_OWNER_MISMATCH", message: "Worker does not own this outbox lease." };
    item.status = "SENT";
    item.sentAt = completedAt;
    item.providerReference = providerReference;
    item.lockedAt = undefined;
    item.lockedBy = undefined;
    item.updatedAt = completedAt;
    return { ok: true, value: { ...item } };
  }

  async markRetry(eventId: string, workerId: string, failedAt: string, nextAttemptAt: string, nextAttemptCount: number, errorCode: string): Promise<Result<DurableOutboxRow>> {
    const item = this.leased(eventId, workerId);
    if (!item) return { ok: false, code: "LEASE_OWNER_MISMATCH", message: "Worker does not own this outbox lease." };
    item.status = "PENDING";
    item.nextAttemptAt = nextAttemptAt;
    item.attempts = nextAttemptCount;
    item.lastErrorCode = errorCode;
    item.lockedAt = undefined;
    item.lockedBy = undefined;
    item.updatedAt = failedAt;
    return { ok: true, value: { ...item } };
  }

  async markFailed(eventId: string, workerId: string, failedAt: string, attempts: number, errorCode: string): Promise<Result<DurableOutboxRow>> {
    const item = this.leased(eventId, workerId);
    if (!item) return { ok: false, code: "LEASE_OWNER_MISMATCH", message: "Worker does not own this outbox lease." };
    item.status = "FAILED";
    item.attempts = attempts;
    item.lastErrorCode = errorCode;
    item.lockedAt = undefined;
    item.lockedBy = undefined;
    item.updatedAt = failedAt;
    return { ok: true, value: { ...item } };
  }

  async markSuppressed(eventId: string, workerId: string, failedAt: string, attempts: number, code: string): Promise<Result<DurableOutboxRow>> {
    const item = this.leased(eventId, workerId);
    if (!item) return { ok: false, code: "LEASE_OWNER_MISMATCH", message: "Worker does not own this outbox lease." };
    item.status = "SUPPRESSED";
    item.attempts = attempts;
    item.lastErrorCode = code;
    item.lockedAt = undefined;
    item.lockedBy = undefined;
    item.updatedAt = failedAt;
    return { ok: true, value: { ...item } };
  }
}

function executor(outcomes: Record<string, OutboxExecutionOutcome | "THROW" | "RESULT_ERROR">): OutboxExecutionPort {
  return {
    async execute(event: ClaimedOutboxEvent): Promise<Result<OutboxExecutionOutcome>> {
      const outcome = outcomes[event.id];
      if (outcome === "THROW") throw new Error("network down");
      if (outcome === "RESULT_ERROR") return { ok: false, code: "EXECUTION_PORT_DOWN", message: "executor unavailable" };
      if (!outcome) return { ok: true, value: { outcome: "SENT", completedAt: t0 } };
      return { ok: true, value: outcome };
    },
  };
}

async function main() {
  assert.equal(minimumBackoffSeconds(1, 60, 3600), 60);
  assert.equal(minimumBackoffSeconds(3, 60, 3600), 240);
  assert.deepEqual(decideOutboxPersistence({
    event: { id: "e", attempt: 1 },
    maxAttempts: 3,
    outcome: { outcome: "RETRYABLE_FAILURE", failedAt: t0, code: "HTTP_500", retryAfterSeconds: 10 },
  }), { ok: true, value: { action: "markRetry", eventId: "e", failedAt: t0, nextAttemptAt: plusSeconds(t0, 60), nextAttemptCount: 1, errorCode: "HTTP_500" } });
  assert.deepEqual(decideOutboxPersistence({
    event: { id: "e", attempt: 1 },
    maxAttempts: 3,
    outcome: { outcome: "RETRYABLE_FAILURE", failedAt: t0, code: "RATE_LIMIT", retryAfterSeconds: 180 },
  }), { ok: true, value: { action: "markRetry", eventId: "e", failedAt: t0, nextAttemptAt: plusSeconds(t0, 180), nextAttemptCount: 1, errorCode: "RATE_LIMIT" } });

  const leases = new InMemoryOutboxRepository([row("lease"), row("sent", { status: "SENT" }), row("failed", { status: "FAILED" }), row("suppressed", { status: "SUPPRESSED" })]);
  const aClaim = await leases.claimReady("worker-a", t0, 60, 10);
  assert.equal(aClaim.ok, true);
  assert.deepEqual(aClaim.ok ? aClaim.value.map((event) => event.id) : [], ["lease"]);

  const bEarly = await leases.claimReady("worker-b", t30, 60, 10);
  assert.equal(bEarly.ok, true);
  assert.deepEqual(bEarly.ok ? bEarly.value : [], []);

  const bLate = await leases.claimReady("worker-b", t61, 60, 10);
  assert.equal(bLate.ok, true);
  assert.deepEqual(bLate.ok ? bLate.value.map((event) => event.id) : [], ["lease"]);

  await assert.rejects(async () => {
    const stale = await leases.markSent("lease", "worker-a", t61, "provider_old");
    if (stale.ok === false) throw new Error(stale.code);
  }, /LEASE_OWNER_MISMATCH/);

  const bSent = await leases.markSent("lease", "worker-b", t61, "provider_1");
  assert.equal(bSent.ok, true);
  assert.equal(leases.rows.get("lease")?.status, "SENT");
  const terminalClaim = await leases.claimReady("worker-c", plusSeconds(t61, 3600), 60, 10);
  assert.equal(terminalClaim.ok, true);
  assert.deepEqual(terminalClaim.ok ? terminalClaim.value : [], []);

  const repo = new InMemoryOutboxRepository([
    row("ok"),
    row("retry"),
    row("fail", { attempts: 2 }),
    row("suppress"),
    row("throws"),
  ]);
  const batch = await runOutboxBatch({
    repository: repo,
    executor: executor({
      ok: { outcome: "SENT", completedAt: t0, providerReference: "provider-ok" },
      retry: { outcome: "RETRYABLE_FAILURE", failedAt: t0, code: "HTTP_500", retryAfterSeconds: 120 },
      fail: { outcome: "RETRYABLE_FAILURE", failedAt: t0, code: "HTTP_500" },
      suppress: { outcome: "SUPPRESSED", failedAt: t0, code: "UNSUBSCRIBED" },
      throws: "THROW",
    }),
    workerId: "worker-main",
    now: t0,
    leaseSeconds: 60,
    maxAttempts: 3,
    limit: 10,
  });
  assert.equal(batch.ok, true);
  if (!batch.ok) throw new Error("batch failed");
  assert.equal(batch.value.claimed, 5);
  assert.equal(batch.value.sent, 1);
  assert.equal(batch.value.retried, 2);
  assert.equal(batch.value.failed, 1);
  assert.equal(batch.value.suppressed, 1);
  assert.equal(repo.rows.get("ok")?.status, "SENT");
  assert.equal(repo.rows.get("ok")?.providerReference, "provider-ok");
  assert.equal(repo.rows.get("retry")?.status, "PENDING");
  assert.equal(repo.rows.get("retry")?.nextAttemptAt, plusSeconds(t0, 120));
  assert.equal(repo.rows.get("fail")?.status, "FAILED");
  assert.equal(repo.rows.get("suppress")?.status, "SUPPRESSED");
  assert.equal(repo.rows.get("throws")?.status, "PENDING");
  assert.equal(repo.rows.get("throws")?.lastErrorCode, "OUTBOX_EXECUTOR_ERROR");

  const invalid = decideOutboxPersistence({
    event: { id: "bad", attempt: 0 },
    maxAttempts: 3,
    outcome: { outcome: "RETRYABLE_FAILURE", failedAt: t0, code: "X" },
  });
  assert.equal(invalid.ok, false);

  console.log("runtime-outage e04 outbox worker harness PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
