import { planProviderRecoveryLease } from "./lease";
import type { ProviderRecoveryQueueRecord } from "./queue";

export interface ProviderRecoveryBatchPlanInput {
  now: string;
  maxItems: number;
  records: ProviderRecoveryQueueRecord[];
}

export interface ProviderRecoveryBatchPlan {
  ready: ProviderRecoveryQueueRecord[];
  deferred: number;
  heldForOperator: number;
  duplicateSuppressed: number;
}

export interface LeasedProviderRecoveryBatchPlanInput extends ProviderRecoveryBatchPlanInput {
  workerId: string;
  leaseDurationSeconds?: number;
}

export interface LeasedProviderRecoveryBatchPlan extends ProviderRecoveryBatchPlan {
  skipped: Array<{ idempotencyKey: string; reason: "LEASED" }>;
}

function autoRunnable(record: ProviderRecoveryQueueRecord): boolean {
  return record.queue === "provider-retry" || record.queue === "provider-reconciliation";
}

function dueAt(record: ProviderRecoveryQueueRecord): number {
  if (record.queue === "provider-reconciliation") return new Date(record.queuedAt).getTime();
  return new Date(record.nextAttemptAt ?? record.queuedAt).getTime();
}

function sortedRunnable(input: ProviderRecoveryBatchPlanInput): {
  runnable: ProviderRecoveryQueueRecord[];
  futureAutoRunnable: number;
  heldForOperator: number;
  duplicateSuppressed: number;
} {
  const now = new Date(input.now).getTime();
  // A bad clock must not turn all records into missing or due work.
  if (!Number.isFinite(now)) return {
    runnable: [], futureAutoRunnable: 0, heldForOperator: input.records.length, duplicateSuppressed: 0,
  };

  let heldForOperator = 0;
  let futureAutoRunnable = 0;
  let duplicateSuppressed = 0;
  const candidates: ProviderRecoveryQueueRecord[] = [];

  for (const record of input.records) {
    if (!autoRunnable(record)) {
      heldForOperator += 1;
      continue;
    }
    // Invalid scheduling metadata is operator-review work, not a reason
    // to make network provider calls or silently lose a queued record.
    if (!Number.isFinite(dueAt(record)) || !Number.isFinite(Date.parse(record.queuedAt)) ||
        !record.workspaceId?.trim() || !record.idempotencyKey?.trim()) {
      heldForOperator += 1;
      continue;
    }
    candidates.push(record);
  }

  candidates.sort((left, right) => {
    const dueDelta = dueAt(left) - dueAt(right);
    if (dueDelta !== 0) return dueDelta;
    const queuedDelta = Date.parse(left.queuedAt) - Date.parse(right.queuedAt);
    if (queuedDelta !== 0) return queuedDelta;
    return left.idempotencyKey.localeCompare(right.idempotencyKey);
  });

  // The scheduler is a read-only *plan*, not an atomic DB claim. At minimum
  // it must never return the same recovery attempt twice within one batch.
  const seen = new Set<string>();
  const runnable: ProviderRecoveryQueueRecord[] = [];
  for (const record of candidates) {
    const key = JSON.stringify([record.workspaceId, record.provider, record.operation, record.idempotencyKey]);
    if (seen.has(key)) {
      duplicateSuppressed += 1;
      continue;
    }
    seen.add(key);
    if (dueAt(record) <= now) runnable.push(record);
    else futureAutoRunnable += 1;
  }

  return { runnable, futureAutoRunnable, heldForOperator, duplicateSuppressed };
}

export function planProviderRecoveryBatch(input: ProviderRecoveryBatchPlanInput): ProviderRecoveryBatchPlan {
  const maxItems = Number.isFinite(input.maxItems) ? Math.max(0, Math.floor(input.maxItems)) : 0;
  const { runnable, futureAutoRunnable, heldForOperator, duplicateSuppressed } = sortedRunnable(input);
  const ready = runnable.slice(0, maxItems);
  const dueButLimited = Math.max(0, runnable.length - ready.length);

  return {
    ready,
    deferred: futureAutoRunnable + dueButLimited,
    heldForOperator,
    duplicateSuppressed,
  };
}

export function planLeasedProviderRecoveryBatch(input: LeasedProviderRecoveryBatchPlanInput): LeasedProviderRecoveryBatchPlan {
  const maxItems = Number.isFinite(input.maxItems) ? Math.max(0, Math.floor(input.maxItems)) : 0;
  const { runnable, futureAutoRunnable, heldForOperator, duplicateSuppressed } = sortedRunnable(input);
  const ready: ProviderRecoveryQueueRecord[] = [];
  const skipped: Array<{ idempotencyKey: string; reason: "LEASED" }> = [];

  for (const record of runnable) {
    const lease = planProviderRecoveryLease({
      workspaceId: record.workspaceId,
      idempotencyKey: record.idempotencyKey,
      workerId: input.workerId,
      now: input.now,
      leaseOwner: record.leasedBy,
      leaseExpiresAt: record.leaseExpiresAt,
      leaseDurationSeconds: input.leaseDurationSeconds,
    });

    if (!lease.canExecute) {
      skipped.push({ idempotencyKey: record.idempotencyKey, reason: "LEASED" });
      continue;
    }

    if (ready.length >= maxItems) continue;
    ready.push({
      ...record,
      leasedBy: lease.holder,
      leaseExpiresAt: lease.leaseExpiresAt,
      mutatesBusinessTruth: false,
    });
  }

  const availableButLimited = Math.max(0, runnable.length - skipped.length - ready.length);

  return {
    ready,
    deferred: futureAutoRunnable + availableButLimited,
    heldForOperator,
    duplicateSuppressed,
    skipped,
  };
}
