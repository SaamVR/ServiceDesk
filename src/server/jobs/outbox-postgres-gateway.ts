import type {
  DurableOutboxRow,
  DurableOutboxTableError,
  DurableOutboxTableGateway,
  DurableOutboxTableResult,
} from "./outbox-repository";

export interface OutboxRpcResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface TrustedOutboxRpcClient {
  rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<OutboxRpcResponse<T>>;
}

interface OutboxDbRow {
  id: string;
  workspace_id: string;
  topic: string;
  payload: Record<string, unknown>;
  status: DurableOutboxRow["status"];
  attempts: number;
  idempotency_key: string;
  next_attempt_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
  sent_at: string | null;
  provider_reference: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

function mapError(error: { message: string; code?: string } | null): DurableOutboxTableError | null {
  return error ? { message: error.message, code: error.code } : null;
}

function mapRow(row: OutboxDbRow): DurableOutboxRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    topic: row.topic,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    idempotencyKey: row.idempotency_key,
    nextAttemptAt: row.next_attempt_at ?? undefined,
    lockedAt: row.locked_at ?? undefined,
    lockedBy: row.locked_by ?? undefined,
    sentAt: row.sent_at ?? undefined,
    providerReference: row.provider_reference ?? undefined,
    lastErrorCode: row.last_error_code ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function firstRow(data: unknown): OutboxDbRow | null {
  if (Array.isArray(data)) return (data[0] as OutboxDbRow | undefined) ?? null;
  if (data && typeof data === "object") return data as OutboxDbRow;
  return null;
}

async function complete(
  client: TrustedOutboxRpcClient,
  args: Record<string, unknown>,
): Promise<DurableOutboxTableResult<DurableOutboxRow>> {
  const result = await client.rpc<OutboxDbRow | OutboxDbRow[]>("complete_outbox_event", args);
  if (result.error) return { data: null, error: mapError(result.error) };
  const row = firstRow(result.data);
  return { data: row ? mapRow(row) : null, error: null };
}

export function createPostgresOutboxTableGateway(client: TrustedOutboxRpcClient): DurableOutboxTableGateway {
  return {
    async claimReady(workerId, now, leaseSeconds, limit) {
      const result = await client.rpc<OutboxDbRow[]>("claim_ready_outbox_events", {
        p_worker_id: workerId,
        p_now: now,
        p_lease_seconds: leaseSeconds,
        p_limit: limit,
      });
      if (result.error) return { data: null, error: mapError(result.error) };
      return { data: (result.data ?? []).map(mapRow), error: null };
    },

    markSent(eventId, workerId, completedAt, providerReference) {
      return complete(client, {
        p_event_id: eventId,
        p_worker_id: workerId,
        p_status: "SENT",
        p_at: completedAt,
        p_attempts: null,
        p_error_code: null,
        p_next_attempt_at: null,
        p_provider_reference: providerReference ?? null,
      });
    },

    markRetry(eventId, workerId, failedAt, nextAttemptAt, nextAttemptCount, errorCode) {
      return complete(client, {
        p_event_id: eventId,
        p_worker_id: workerId,
        p_status: "PENDING",
        p_at: failedAt,
        p_attempts: nextAttemptCount,
        p_error_code: errorCode,
        p_next_attempt_at: nextAttemptAt,
        p_provider_reference: null,
      });
    },

    markFailed(eventId, workerId, failedAt, attempts, errorCode) {
      return complete(client, {
        p_event_id: eventId,
        p_worker_id: workerId,
        p_status: "FAILED",
        p_at: failedAt,
        p_attempts: attempts,
        p_error_code: errorCode,
        p_next_attempt_at: null,
        p_provider_reference: null,
      });
    },

    markSuppressed(eventId, workerId, failedAt, attempts, code) {
      return complete(client, {
        p_event_id: eventId,
        p_worker_id: workerId,
        p_status: "SUPPRESSED",
        p_at: failedAt,
        p_attempts: attempts,
        p_error_code: code,
        p_next_attempt_at: null,
        p_provider_reference: null,
      });
    },
  };
}
