import type { OutboxExecutionOutcome, OutboxExecutionPort, Result } from "../../contracts";
import type { ClaimedDurableOutboxEvent, DurableOutboxRepository } from "./outbox-repository";
import { decideOutboxPersistence } from "./outbox-retry";
import type { OutboxExecutionGuard } from "./outbox-execution-guard";

export interface RunOutboxBatchInput {
  repository: DurableOutboxRepository;
  executor: OutboxExecutionPort;
  workerId: string;
  now: string;
  leaseSeconds: number;
  maxAttempts: number;
  limit: number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
  guard?: OutboxExecutionGuard;
}

export interface OutboxBatchItemSummary {
  eventId: string;
  status: "SENT" | "RETRY" | "FAILED" | "SUPPRESSED" | "PERSISTENCE_FAILED";
  code?: string;
}

export interface OutboxBatchSummary {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  suppressed: number;
  persistenceFailed: number;
  items: OutboxBatchItemSummary[];
}

function emptySummary(): OutboxBatchSummary {
  return { claimed: 0, sent: 0, retried: 0, failed: 0, suppressed: 0, persistenceFailed: 0, items: [] };
}

function executorInfrastructureFailure(event: ClaimedDurableOutboxEvent, now: string): OutboxExecutionOutcome {
  return { outcome: "RETRYABLE_FAILURE", failedAt: now, code: "OUTBOX_EXECUTOR_ERROR" };
}

export async function runOutboxBatch(input: RunOutboxBatchInput): Promise<Result<OutboxBatchSummary>> {
  const claimed = await input.repository.claimReady(input.workerId, input.now, input.leaseSeconds, input.limit);
  if (claimed.ok === false) return claimed;

  const summary = emptySummary();
  summary.claimed = claimed.value.length;

  for (const event of claimed.value) {
    let outcome: OutboxExecutionOutcome;
    if (input.guard) {
      try {
        const checked = await input.guard.check(event, input.now);
        if (!checked.ok) {
          outcome = {
            outcome: "RETRYABLE_FAILURE",
            failedAt: input.now,
            code: "OUTBOX_GUARD_ERROR",
          };
        } else if (!checked.value.allowed) {
          outcome = {
            outcome: "SUPPRESSED",
            failedAt: input.now,
            code: checked.value.code ?? "OUTBOX_SUPPRESSED",
          };
        } else {
          const executed = await input.executor.execute(event);
          outcome = executed.ok ? executed.value : executorInfrastructureFailure(event, input.now);
        }
      } catch {
        outcome = {
          outcome: "RETRYABLE_FAILURE",
          failedAt: input.now,
          code: "OUTBOX_GUARD_ERROR",
        };
      }
    } else {
      try {
        const executed = await input.executor.execute(event);
        outcome = executed.ok ? executed.value : executorInfrastructureFailure(event, input.now);
      } catch {
        outcome = executorInfrastructureFailure(event, input.now);
      }
    }

    const decision = decideOutboxPersistence({
      event,
      outcome,
      maxAttempts: input.maxAttempts,
      baseDelaySeconds: input.baseDelaySeconds,
      maxDelaySeconds: input.maxDelaySeconds,
    });

    if (decision.ok === false) {
      const persisted = await input.repository.markFailed(event.id, input.workerId, input.now, event.attempt, decision.code);
      if (persisted.ok === false) {
        summary.persistenceFailed += 1;
        summary.items.push({ eventId: event.id, status: "PERSISTENCE_FAILED", code: persisted.code });
      } else {
        summary.failed += 1;
        summary.items.push({ eventId: event.id, status: "FAILED", code: decision.code });
      }
      continue;
    }

    const value = decision.value;
    if (value.action === "markSent") {
      const persisted = await input.repository.markSent(value.eventId, input.workerId, value.completedAt, value.providerReference);
      if (persisted.ok === false) {
        summary.persistenceFailed += 1;
        summary.items.push({ eventId: event.id, status: "PERSISTENCE_FAILED", code: persisted.code });
      } else {
        summary.sent += 1;
        summary.items.push({ eventId: event.id, status: "SENT" });
      }
      continue;
    }

    if (value.action === "markRetry") {
      const persisted = await input.repository.markRetry(value.eventId, input.workerId, value.failedAt, value.nextAttemptAt, value.nextAttemptCount, value.errorCode);
      if (persisted.ok === false) {
        summary.persistenceFailed += 1;
        summary.items.push({ eventId: event.id, status: "PERSISTENCE_FAILED", code: persisted.code });
      } else {
        summary.retried += 1;
        summary.items.push({ eventId: event.id, status: "RETRY", code: value.errorCode });
      }
      continue;
    }

    if (value.action === "markSuppressed") {
      const persisted = await input.repository.markSuppressed(value.eventId, input.workerId, value.failedAt, value.attempts, value.code);
      if (persisted.ok === false) {
        summary.persistenceFailed += 1;
        summary.items.push({ eventId: event.id, status: "PERSISTENCE_FAILED", code: persisted.code });
      } else {
        summary.suppressed += 1;
        summary.items.push({ eventId: event.id, status: "SUPPRESSED", code: value.code });
      }
      continue;
    }

    const persisted = await input.repository.markFailed(value.eventId, input.workerId, value.failedAt, value.attempts, value.errorCode);
    if (persisted.ok === false) {
      summary.persistenceFailed += 1;
      summary.items.push({ eventId: event.id, status: "PERSISTENCE_FAILED", code: persisted.code });
    } else {
      summary.failed += 1;
      summary.items.push({ eventId: event.id, status: "FAILED", code: value.errorCode });
    }
  }

  return { ok: true, value: summary };
}
