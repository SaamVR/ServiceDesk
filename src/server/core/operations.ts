import type { Result } from "../../contracts";
import {
  appendLedgerEntry,
  enqueueOutboxEvent,
  raiseAttentionItem,
  recordOutboxFailure,
  type AppendLedgerEntryInput,
  type AttentionItem,
  type EnqueueOutboxEventInput,
  type LedgerEntry,
  type OutboxEvent,
  type RaiseAttentionItemInput,
} from "../../domain/operations";

export interface OperationsRepository {
  nextLedgerId(): string;
  findLedgerByIdempotency(workspaceId: string, idempotencyKey: string): Promise<LedgerEntry | undefined>;
  insertLedgerEntry(entry: LedgerEntry): Promise<Result<LedgerEntry>>;

  nextOutboxId(): string;
  findOutboxByIdempotency(workspaceId: string, idempotencyKey: string): Promise<OutboxEvent | undefined>;
  insertOutboxEvent(event: OutboxEvent): Promise<Result<OutboxEvent>>;
  updateOutboxEvent(event: OutboxEvent): Promise<Result<OutboxEvent>>;

  nextAttentionId(): string;
  findOpenAttentionItem(workspaceId: string, type: string, resourceType: string, resourceId: string): Promise<AttentionItem | undefined>;
  insertAttentionItem(item: AttentionItem): Promise<Result<AttentionItem>>;
}

export async function appendLedgerEntryWithRepository(
  repository: OperationsRepository,
  input: AppendLedgerEntryInput,
): Promise<Result<{ entry: LedgerEntry; created: boolean }>> {
  const existing = await repository.findLedgerByIdempotency(input.workspaceId, input.idempotencyKey);
  const appended = appendLedgerEntry(existing ? [existing] : [], input, () => repository.nextLedgerId());
  if (appended.ok === false) return appended;
  if (!appended.value.created) return appended;

  const inserted = await repository.insertLedgerEntry(appended.value.entry);
  if (inserted.ok === false) return inserted;
  return { ok: true, value: { entry: inserted.value, created: true } };
}

export async function enqueueOutboxEventWithRepository(
  repository: OperationsRepository,
  input: EnqueueOutboxEventInput,
): Promise<Result<{ event: OutboxEvent; created: boolean }>> {
  const existing = await repository.findOutboxByIdempotency(input.workspaceId, input.idempotencyKey);
  const enqueued = enqueueOutboxEvent(existing ? [existing] : [], input, () => repository.nextOutboxId());
  if (enqueued.ok === false) return enqueued;
  if (!enqueued.value.created) return enqueued;

  const inserted = await repository.insertOutboxEvent(enqueued.value.event);
  if (inserted.ok === false) return inserted;
  return { ok: true, value: { event: inserted.value, created: true } };
}

export async function recordOutboxFailureWithRepository(
  repository: OperationsRepository,
  event: OutboxEvent,
  failedAt: string,
  maxAttempts: number,
): Promise<Result<OutboxEvent>> {
  const failed = recordOutboxFailure(event, failedAt, maxAttempts);
  return repository.updateOutboxEvent(failed);
}

export async function raiseAttentionItemWithRepository(
  repository: OperationsRepository,
  input: RaiseAttentionItemInput,
): Promise<Result<{ item: AttentionItem; created: boolean }>> {
  const existing = await repository.findOpenAttentionItem(input.workspaceId, input.type, input.resourceType, input.resourceId);
  const raised = raiseAttentionItem(existing ? [existing] : [], input, () => repository.nextAttentionId());
  if (raised.ok === false) return raised;
  if (!raised.value.created) return raised;

  const inserted = await repository.insertAttentionItem(raised.value.item);
  if (inserted.ok === false) return inserted;
  return { ok: true, value: { item: inserted.value, created: true } };
}
