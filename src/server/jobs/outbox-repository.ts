import type { ClaimedOutboxEvent, Result } from "../../contracts";

export type DurableOutboxStatus = "PENDING" | "SENT" | "FAILED" | "SUPPRESSED";

export interface DurableOutboxRow {
  id: string;
  workspaceId: string;
  topic: string;
  payload: Record<string, unknown>;
  status: DurableOutboxStatus;
  attempts: number;
  idempotencyKey: string;
  nextAttemptAt?: string;
  lockedAt?: string;
  lockedBy?: string;
  sentAt?: string;
  providerReference?: string;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimedDurableOutboxEvent extends ClaimedOutboxEvent {
  lockedBy: string;
}

export interface DurableOutboxRepository {
  claimReady(workerId: string, now: string, leaseSeconds: number, limit: number): Promise<Result<ClaimedDurableOutboxEvent[]>>;
  markSent(eventId: string, workerId: string, completedAt: string, providerReference?: string): Promise<Result<DurableOutboxRow>>;
  markRetry(eventId: string, workerId: string, failedAt: string, nextAttemptAt: string, nextAttemptCount: number, errorCode: string): Promise<Result<DurableOutboxRow>>;
  markFailed(eventId: string, workerId: string, failedAt: string, attempts: number, errorCode: string): Promise<Result<DurableOutboxRow>>;
  markSuppressed(eventId: string, workerId: string, failedAt: string, attempts: number, code: string): Promise<Result<DurableOutboxRow>>;
}

export interface DurableOutboxTableError {
  message: string;
  code?: string;
}

export interface DurableOutboxTableResult<T> {
  data: T | null;
  error: DurableOutboxTableError | null;
}

export interface DurableOutboxTableGateway {
  claimReady(workerId: string, now: string, leaseSeconds: number, limit: number): Promise<DurableOutboxTableResult<DurableOutboxRow[]>>;
  markSent(eventId: string, workerId: string, completedAt: string, providerReference?: string): Promise<DurableOutboxTableResult<DurableOutboxRow>>;
  markRetry(eventId: string, workerId: string, failedAt: string, nextAttemptAt: string, nextAttemptCount: number, errorCode: string): Promise<DurableOutboxTableResult<DurableOutboxRow>>;
  markFailed(eventId: string, workerId: string, failedAt: string, attempts: number, errorCode: string): Promise<DurableOutboxTableResult<DurableOutboxRow>>;
  markSuppressed(eventId: string, workerId: string, failedAt: string, attempts: number, code: string): Promise<DurableOutboxTableResult<DurableOutboxRow>>;
}

export function claimedOutboxEventFromRow(row: DurableOutboxRow, workerId: string): ClaimedDurableOutboxEvent {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    topic: row.topic,
    payload: row.payload,
    idempotencyKey: row.idempotencyKey,
    attempt: row.attempts,
    claimedAt: row.lockedAt ?? row.updatedAt,
    lockedBy: workerId,
  };
}

function repositoryError(error: DurableOutboxTableError): Result<never> {
  return { ok: false, code: error.code ?? "OUTBOX_REPOSITORY_ERROR", message: error.message };
}

function missingRow(): Result<never> {
  return { ok: false, code: "OUTBOX_ROW_NOT_FOUND", message: "Outbox row was not found or is not leased by this worker." };
}

function invalidWorkerId(): Result<never> {
  return { ok: false, code: "OUTBOX_WORKER_ID_REQUIRED", message: "Outbox worker id is required." };
}

export function validateWorkerId(workerId: string): Result<true> {
  if (!workerId.trim()) return invalidWorkerId();
  return { ok: true, value: true };
}

export function createDurableOutboxRepository(gateway: DurableOutboxTableGateway): DurableOutboxRepository {
  return {
    async claimReady(workerId, now, leaseSeconds, limit) {
      const validWorker = validateWorkerId(workerId);
      if (validWorker.ok === false) return validWorker;
      if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || !Number.isInteger(limit) || limit < 1) {
        return { ok: false, code: "OUTBOX_CLAIM_CONFIG_INVALID", message: "Outbox claim requires positive integer leaseSeconds and limit." };
      }
      const result = await gateway.claimReady(workerId, now, leaseSeconds, limit);
      if (result.error) return repositoryError(result.error);
      return { ok: true, value: (result.data ?? []).map((row) => claimedOutboxEventFromRow(row, workerId)) };
    },
    async markSent(eventId, workerId, completedAt, providerReference) {
      const validWorker = validateWorkerId(workerId);
      if (validWorker.ok === false) return validWorker;
      const result = await gateway.markSent(eventId, workerId, completedAt, providerReference);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return missingRow();
      return { ok: true, value: result.data };
    },
    async markRetry(eventId, workerId, failedAt, nextAttemptAt, nextAttemptCount, errorCode) {
      const validWorker = validateWorkerId(workerId);
      if (validWorker.ok === false) return validWorker;
      const result = await gateway.markRetry(eventId, workerId, failedAt, nextAttemptAt, nextAttemptCount, errorCode);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return missingRow();
      return { ok: true, value: result.data };
    },
    async markFailed(eventId, workerId, failedAt, attempts, errorCode) {
      const validWorker = validateWorkerId(workerId);
      if (validWorker.ok === false) return validWorker;
      const result = await gateway.markFailed(eventId, workerId, failedAt, attempts, errorCode);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return missingRow();
      return { ok: true, value: result.data };
    },
    async markSuppressed(eventId, workerId, failedAt, attempts, code) {
      const validWorker = validateWorkerId(workerId);
      if (validWorker.ok === false) return validWorker;
      const result = await gateway.markSuppressed(eventId, workerId, failedAt, attempts, code);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return missingRow();
      return { ok: true, value: result.data };
    },
  };
}
