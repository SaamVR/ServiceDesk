import { describe, expect, it } from "vitest";
import type { AttentionItem, LedgerEntry, OutboxEvent } from "../../src/domain/operations";
import {
  appendLedgerEntryWithRepository,
  enqueueOutboxEventWithRepository,
  raiseAttentionItemWithRepository,
  recordOutboxFailureWithRepository,
} from "../../src/server/core/operations";

const now = "2026-10-04T06:00:00.000Z";

describe("operations command repository seam", () => {
  it("appends ledger entries idempotently through a repository", async () => {
    const inserted: LedgerEntry[] = [];
    const repo = {
      nextLedgerId: () => "ledger_1",
      findLedgerByIdempotency: async () => undefined,
      insertLedgerEntry: async (entry: LedgerEntry) => { inserted.push(entry); return { ok: true as const, value: entry }; },
      nextOutboxId: () => "outbox_unused",
      findOutboxByIdempotency: async () => undefined,
      insertOutboxEvent: async (event: OutboxEvent) => ({ ok: true as const, value: event }),
      updateOutboxEvent: async (event: OutboxEvent) => ({ ok: true as const, value: event }),
      nextAttentionId: () => "attn_unused",
      findOpenAttentionItem: async () => undefined,
      insertAttentionItem: async (item: AttentionItem) => ({ ok: true as const, value: item }),
    };

    await expect(appendLedgerEntryWithRepository(repo, {
      workspaceId: "ws_1",
      resourceType: "VISIT",
      resourceId: "visit_1",
      direction: "CREDIT",
      amountMinor: 8_500,
      currency: "USD",
      idempotencyKey: "payment_evt_1",
      occurredAt: now,
    })).resolves.toMatchObject({ ok: true, value: { created: true, entry: { id: "ledger_1" } } });
    expect(inserted).toHaveLength(1);
  });

  it("deduplicates outbox enqueue and updates failed retry state", async () => {
    const existing: OutboxEvent = {
      id: "outbox_1",
      workspaceId: "ws_1",
      topic: "visit.confirmed",
      payload: { visitId: "visit_1" },
      status: "PENDING",
      attempts: 1,
      idempotencyKey: "visit_1:confirmed",
      createdAt: now,
    };
    const updated: OutboxEvent[] = [];
    const repo = {
      nextLedgerId: () => "ledger_unused",
      findLedgerByIdempotency: async () => undefined,
      insertLedgerEntry: async (entry: LedgerEntry) => ({ ok: true as const, value: entry }),
      nextOutboxId: () => "outbox_2",
      findOutboxByIdempotency: async () => existing,
      insertOutboxEvent: async (event: OutboxEvent) => ({ ok: true as const, value: event }),
      updateOutboxEvent: async (event: OutboxEvent) => { updated.push(event); return { ok: true as const, value: event }; },
      nextAttentionId: () => "attn_unused",
      findOpenAttentionItem: async () => undefined,
      insertAttentionItem: async (item: AttentionItem) => ({ ok: true as const, value: item }),
    };

    await expect(enqueueOutboxEventWithRepository(repo, {
      workspaceId: "ws_1",
      topic: "visit.confirmed",
      payload: { visitId: "visit_1" },
      idempotencyKey: "visit_1:confirmed",
      createdAt: now,
    })).resolves.toEqual({ ok: true, value: { event: existing, created: false } });

    await expect(recordOutboxFailureWithRepository(repo, existing, "2026-10-04T06:01:00.000Z", 3)).resolves.toMatchObject({
      ok: true,
      value: { attempts: 2, nextAttemptAt: "2026-10-04T06:05:00.000Z" },
    });
    expect(updated).toHaveLength(1);
  });

  it("raises attention items idempotently through a repository", async () => {
    const inserted: AttentionItem[] = [];
    const repo = {
      nextLedgerId: () => "ledger_unused",
      findLedgerByIdempotency: async () => undefined,
      insertLedgerEntry: async (entry: LedgerEntry) => ({ ok: true as const, value: entry }),
      nextOutboxId: () => "outbox_unused",
      findOutboxByIdempotency: async () => undefined,
      insertOutboxEvent: async (event: OutboxEvent) => ({ ok: true as const, value: event }),
      updateOutboxEvent: async (event: OutboxEvent) => ({ ok: true as const, value: event }),
      nextAttentionId: () => "attn_1",
      findOpenAttentionItem: async () => undefined,
      insertAttentionItem: async (item: AttentionItem) => { inserted.push(item); return { ok: true as const, value: item }; },
    };

    await expect(raiseAttentionItemWithRepository(repo, {
      workspaceId: "ws_1",
      type: "PAYMENT_REVIEW",
      resourceType: "QUOTE",
      resourceId: "quote_1",
      severity: "WARNING",
      summary: "Payment needs manual review",
      createdAt: now,
    })).resolves.toMatchObject({ ok: true, value: { created: true, item: { id: "attn_1", status: "OPEN" } } });
    expect(inserted).toHaveLength(1);
  });
});
