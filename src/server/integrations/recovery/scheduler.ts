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

function sortedRunnable(input: ProviderRecoveryBatchPlanInput): { runnable: ProviderRecoveryQueueRecord[]; futureAutoRunnable: number; heldForOperator: number } {
  const now = new Date(input.now).getTime();
  let heldForOperator = 0;
  let futureAutoRunnable = 0;
  const runnable: ProviderRecoveryQueueRecord[] = [];

  for (const record of input.records) {
    if (!autoRunnable(record)) {
      heldForOperator += 1;
      continue;
    }

    if (dueAt(record) <= now) runnable.push(record);
    else futureAutoRunnable += 1;
  }

  runnable.sort((left, right) => {
    const dueDelta = dueAt(left) - dueAt(right);
    if (dueDelta !== 0) return dueDelta;
    const queuedDelta = new Date(left.queuedAt).getTime() - new Date(right.queuedAt).getTime();
    if (queuedDelta !== 0) return queuedDelta;
    return left.idempotencyKey.localeCompare(right.idempotencyKey);
  });

  return { runnable, futureAutoRunnable, heldForOperator };
}

export function planProviderRecoveryBatch(input: ProviderRecoveryBatchPlanInput): ProviderRecoveryBatchPlan {
  const maxItems = Math.max(0, Math.floor(input.maxItems));
  const { runnable, futureAutoRunnable, heldForOperator } = sortedRunnable(input);
  const ready = runnable.slice(0, maxItems);
  const dueButLimited = Math.max(0, runnable.length - ready.length);

  return {
    ready,
    deferred: futureAutoRunnable + dueButLimited,
    heldForOperator,
  };
}

export function planLeasedProviderRecoveryBatch(input: LeasedProviderRecoveryBatchPlanInput): LeasedProviderRecoveryBatchPlan {
  const maxItems = Math.max(0, Math.floor(input.maxItems));
  const { runnable, futureAutoRunnable, heldForOperator } = sortedRunnable(input);
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

    if (ready.length >= maxItems) break;
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
    skipped,
  };
}
