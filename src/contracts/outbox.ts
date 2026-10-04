import type { Result } from "./core";

export interface ClaimedOutboxEvent {
  id: string;
  workspaceId: string;
  topic: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  attempt: number;
  claimedAt: string;
}

export type OutboxExecutionOutcome =
  | { outcome: "SENT"; completedAt: string; providerReference?: string }
  | { outcome: "RETRYABLE_FAILURE"; failedAt: string; code: string; retryAfterSeconds?: number }
  | { outcome: "TERMINAL_FAILURE"; failedAt: string; code: string }
  | { outcome: "SUPPRESSED"; failedAt: string; code: string };

export interface OutboxExecutionPort {
  execute(event: ClaimedOutboxEvent): Promise<Result<OutboxExecutionOutcome>>;
}
