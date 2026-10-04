import { describe, expect, it } from "vitest";
import {
  appendLedgerEntry,
  enqueueOutboxEvent,
  raiseAttentionItem,
  recordOutboxFailure,
  type AttentionItem,
  type LedgerEntry,
  type OutboxEvent,
} from "../../src/domain/operations";

const now = "2026-10-04T06:00:00.000Z";

describe("ledger, outbox, and attention primitives", () => {
  it("deduplicates ledger entries by workspace and idempotency key", () => {
    const existing: LedgerEntry[] = [{
      id: "ledger_existing",
      workspaceId: "ws_1",
      resourceType: "VISIT",
      resourceId: "visit_1",
      direction: "CREDIT",
      amountMinor: 8_500,
      currency: "USD",
      idempotencyKey: "payment_evt_1",
      occurredAt: now,
    }];

    expect(appendLedgerEntry(existing, {
      workspaceId: "ws_1",
      resourceType: "VISIT",
      resourceId: "visit_1",
      direction: "CREDIT",
      amountMinor: 8_500,
      currency: "USD",
      idempotencyKey: "payment_evt_1",
      occurredAt: now,
    }, () => "ledger_new")).toEqual({ ok: true, value: { entry: existing[0], created: false } });

    expect(appendLedgerEntry(existing, {
      workspaceId: "ws_1",
      resourceType: "VISIT",
      resourceId: "visit_1",
      direction: "CREDIT",
      amountMinor: 25_500,
      currency: "USD",
      idempotencyKey: "payment_evt_2",
      occurredAt: now,
    }, () => "ledger_new")).toMatchObject({
      ok: true,
      value: { created: true, entry: { id: "ledger_new", amountMinor: 25_500, idempotencyKey: "payment_evt_2" } },
    });
  });

  it("deduplicates outbox events and schedules bounded retry after failure", () => {
    const event: OutboxEvent = {
      id: "outbox_1",
      workspaceId: "ws_1",
      topic: "quote.sent",
      payload: { quoteId: "quote_1" },
      status: "PENDING",
      attempts: 1,
      idempotencyKey: "quote_1:send",
      createdAt: now,
    };

    expect(enqueueOutboxEvent([event], {
      workspaceId: "ws_1",
      topic: "quote.sent",
      payload: { quoteId: "quote_1" },
      idempotencyKey: "quote_1:send",
      createdAt: now,
    }, () => "outbox_2")).toEqual({ ok: true, value: { event, created: false } });

    expect(recordOutboxFailure(event, "2026-10-04T06:01:00.000Z", 3)).toMatchObject({
      status: "PENDING",
      attempts: 2,
      nextAttemptAt: "2026-10-04T06:05:00.000Z",
    });

    expect(recordOutboxFailure({ ...event, attempts: 2 }, "2026-10-04T06:01:00.000Z", 3)).toMatchObject({
      status: "FAILED",
      attempts: 3,
      nextAttemptAt: undefined,
    });
  });

  it("deduplicates open attention items by workspace, type, and resource", () => {
    const existing: AttentionItem = {
      id: "attn_1",
      workspaceId: "ws_1",
      type: "PAYMENT_REVIEW",
      resourceType: "QUOTE",
      resourceId: "quote_1",
      severity: "WARNING",
      status: "OPEN",
      summary: "Payment needs review",
      createdAt: now,
    };

    expect(raiseAttentionItem([existing], {
      workspaceId: "ws_1",
      type: "PAYMENT_REVIEW",
      resourceType: "QUOTE",
      resourceId: "quote_1",
      severity: "CRITICAL",
      summary: "Duplicate should not replace existing open item",
      createdAt: now,
    }, () => "attn_2")).toEqual({ ok: true, value: { item: existing, created: false } });
  });
});
