import type { CurrencyCode, Result } from "../contracts";

export type LedgerDirection = "DEBIT" | "CREDIT";
export type OutboxStatus = "PENDING" | "SENT" | "FAILED";
export type AttentionSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AttentionStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface LedgerEntry {
  id: string;
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  direction: LedgerDirection;
  amountMinor: number;
  currency: CurrencyCode;
  idempotencyKey: string;
  occurredAt: string;
}

export type AppendLedgerEntryInput = Omit<LedgerEntry, "id">;

export interface OutboxEvent {
  id: string;
  workspaceId: string;
  topic: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  idempotencyKey: string;
  nextAttemptAt?: string;
  createdAt: string;
}

export type EnqueueOutboxEventInput = Pick<OutboxEvent, "workspaceId" | "topic" | "payload" | "idempotencyKey" | "createdAt">;

export interface AttentionItem {
  id: string;
  workspaceId: string;
  type: string;
  resourceType: string;
  resourceId: string;
  severity: AttentionSeverity;
  status: AttentionStatus;
  summary: string;
  createdAt: string;
}

export type RaiseAttentionItemInput = Omit<AttentionItem, "id" | "status">;

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function sameWorkspaceIdempotency<T extends { workspaceId: string; idempotencyKey: string }>(
  records: readonly T[],
  workspaceId: string,
  idempotencyKey: string,
): T | undefined {
  return records.find((record) => record.workspaceId === workspaceId && record.idempotencyKey === idempotencyKey);
}

export function appendLedgerEntry(
  existing: readonly LedgerEntry[],
  input: AppendLedgerEntryInput,
  createId: () => string,
): Result<{ entry: LedgerEntry; created: boolean }> {
  const duplicate = sameWorkspaceIdempotency(existing, input.workspaceId, input.idempotencyKey);
  if (duplicate) return { ok: true, value: { entry: duplicate, created: false } };

  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, code: "LEDGER_AMOUNT_INVALID", message: "Ledger entry amount must be a positive integer." };
  }

  return { ok: true, value: { entry: { id: createId(), ...input }, created: true } };
}

export function enqueueOutboxEvent(
  existing: readonly OutboxEvent[],
  input: EnqueueOutboxEventInput,
  createId: () => string,
): Result<{ event: OutboxEvent; created: boolean }> {
  const duplicate = sameWorkspaceIdempotency(existing, input.workspaceId, input.idempotencyKey);
  if (duplicate) return { ok: true, value: { event: duplicate, created: false } };

  if (!input.topic.trim()) {
    return { ok: false, code: "OUTBOX_TOPIC_REQUIRED", message: "Outbox topic is required." };
  }

  return {
    ok: true,
    value: {
      event: {
        id: createId(),
        workspaceId: input.workspaceId,
        topic: input.topic,
        payload: input.payload,
        status: "PENDING",
        attempts: 0,
        idempotencyKey: input.idempotencyKey,
        createdAt: input.createdAt,
      },
      created: true,
    },
  };
}

export function recordOutboxFailure(event: OutboxEvent, failedAt: string, maxAttempts: number): OutboxEvent {
  const attempts = event.attempts + 1;
  if (attempts >= maxAttempts) {
    const terminal: OutboxEvent = { ...event, attempts, status: "FAILED" };
    delete terminal.nextAttemptAt;
    return terminal;
  }

  const delayMinutes = 2 ** attempts;
  return {
    ...event,
    attempts,
    status: "PENDING",
    nextAttemptAt: addMinutes(failedAt, delayMinutes),
  };
}

export function raiseAttentionItem(
  existing: readonly AttentionItem[],
  input: RaiseAttentionItemInput,
  createId: () => string,
): Result<{ item: AttentionItem; created: boolean }> {
  const duplicate = existing.find((item) => (
    item.workspaceId === input.workspaceId
    && item.type === input.type
    && item.resourceType === input.resourceType
    && item.resourceId === input.resourceId
    && item.status === "OPEN"
  ));
  if (duplicate) return { ok: true, value: { item: duplicate, created: false } };

  if (!input.summary.trim()) {
    return { ok: false, code: "ATTENTION_SUMMARY_REQUIRED", message: "Attention summary is required." };
  }

  return {
    ok: true,
    value: {
      item: {
        id: createId(),
        workspaceId: input.workspaceId,
        type: input.type,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        severity: input.severity,
        status: "OPEN",
        summary: input.summary,
        createdAt: input.createdAt,
      },
      created: true,
    },
  };
}
