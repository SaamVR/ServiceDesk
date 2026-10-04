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

function autoRunnable(record: ProviderRecoveryQueueRecord): boolean {
  return record.queue === "provider-retry" || record.queue === "provider-reconciliation";
}

function dueAt(record: ProviderRecoveryQueueRecord): number {
  if (record.queue === "provider-reconciliation") return new Date(record.queuedAt).getTime();
  return new Date(record.nextAttemptAt ?? record.queuedAt).getTime();
}

export function planProviderRecoveryBatch(input: ProviderRecoveryBatchPlanInput): ProviderRecoveryBatchPlan {
  const now = new Date(input.now).getTime();
  const maxItems = Math.max(0, Math.floor(input.maxItems));
  let heldForOperator = 0;

  const runnable: ProviderRecoveryQueueRecord[] = [];
  for (const record of input.records) {
    if (!autoRunnable(record)) {
      heldForOperator += 1;
      continue;
    }

    if (dueAt(record) <= now) runnable.push(record);
  }

  runnable.sort((left, right) => {
    const dueDelta = dueAt(left) - dueAt(right);
    if (dueDelta !== 0) return dueDelta;
    const queuedDelta = new Date(left.queuedAt).getTime() - new Date(right.queuedAt).getTime();
    if (queuedDelta !== 0) return queuedDelta;
    return left.idempotencyKey.localeCompare(right.idempotencyKey);
  });

  const ready = runnable.slice(0, maxItems);
  const futureAutoRunnable = input.records.filter((record) => autoRunnable(record) && dueAt(record) > now).length;
  const dueButLimited = Math.max(0, runnable.length - ready.length);

  return {
    ready,
    deferred: futureAutoRunnable + dueButLimited,
    heldForOperator,
  };
}
