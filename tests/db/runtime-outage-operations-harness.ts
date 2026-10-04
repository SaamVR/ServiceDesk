import assert from "node:assert/strict";
import type { AttentionItem, LedgerEntry, OutboxEvent } from "../../src/domain/operations";
import {
  appendLedgerEntryWithRepository,
  raiseAttentionItemWithRepository,
  recordOutboxFailureWithRepository,
} from "../../src/server/core/operations";

const now = "2026-10-04T06:00:00.000Z";
const existingLedger: LedgerEntry = {
  id: "ledger_existing",
  workspaceId: "ws_1",
  resourceType: "VISIT",
  resourceId: "visit_1",
  direction: "CREDIT",
  amountMinor: 8_500,
  currency: "USD",
  idempotencyKey: "payment_evt_1",
  occurredAt: now,
};
const existingAttention: AttentionItem = {
  id: "attn_existing",
  workspaceId: "ws_1",
  type: "PAYMENT_REVIEW",
  resourceType: "QUOTE",
  resourceId: "quote_1",
  severity: "WARNING",
  status: "OPEN",
  summary: "Payment needs manual review",
  createdAt: now,
};

async function main() {
  let ledgerInsertCalls = 0;
  const duplicateLedgerRepo = {
    nextLedgerId: () => "ledger_new",
    findLedgerByIdempotency: async () => existingLedger,
    insertLedgerEntry: async (entry: LedgerEntry) => { ledgerInsertCalls += 1; return { ok: true as const, value: entry }; },
    nextOutboxId: () => "outbox_unused",
    findOutboxByIdempotency: async () => undefined,
    insertOutboxEvent: async (event: OutboxEvent) => ({ ok: true as const, value: event }),
    updateOutboxEvent: async (event: OutboxEvent) => ({ ok: true as const, value: event }),
    nextAttentionId: () => "attn_unused",
    findOpenAttentionItem: async () => undefined,
    insertAttentionItem: async (item: AttentionItem) => ({ ok: true as const, value: item }),
  };
  const duplicateLedger = await appendLedgerEntryWithRepository(duplicateLedgerRepo, {
    workspaceId: "ws_1",
    resourceType: "VISIT",
    resourceId: "visit_1",
    direction: "CREDIT",
    amountMinor: 8_500,
    currency: "USD",
    idempotencyKey: "payment_evt_1",
    occurredAt: now,
  });
  assert.deepEqual(duplicateLedger, { ok: true, value: { entry: existingLedger, created: false } });
  assert.equal(ledgerInsertCalls, 0);

  const terminalOutbox: OutboxEvent = {
    id: "outbox_1",
    workspaceId: "ws_1",
    topic: "visit.confirmed",
    payload: { visitId: "visit_1" },
    status: "PENDING",
    attempts: 2,
    idempotencyKey: "visit_1:confirmed",
    nextAttemptAt: "2026-10-04T06:05:00.000Z",
    createdAt: now,
  };
  const persistedTerminal: OutboxEvent[] = [];
  const terminalRepo = {
    ...duplicateLedgerRepo,
    findLedgerByIdempotency: async () => undefined,
    updateOutboxEvent: async (event: OutboxEvent) => { persistedTerminal.push(event); return { ok: true as const, value: event }; },
  };
  const terminalFailure = await recordOutboxFailureWithRepository(terminalRepo, terminalOutbox, "2026-10-04T06:10:00.000Z", 3);
  assert.equal(terminalFailure.ok, true);
  if (terminalFailure.ok) {
    assert.equal(terminalFailure.value.status, "FAILED");
    assert.equal(terminalFailure.value.attempts, 3);
    assert.equal(Object.prototype.hasOwnProperty.call(terminalFailure.value, "nextAttemptAt"), false);
  }
  assert.equal(persistedTerminal.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(persistedTerminal[0], "nextAttemptAt"), false);

  let attentionInsertCalls = 0;
  const duplicateAttentionRepo = {
    ...duplicateLedgerRepo,
    findLedgerByIdempotency: async () => undefined,
    findOpenAttentionItem: async () => existingAttention,
    insertAttentionItem: async (item: AttentionItem) => { attentionInsertCalls += 1; return { ok: true as const, value: item }; },
  };
  const duplicateAttention = await raiseAttentionItemWithRepository(duplicateAttentionRepo, {
    workspaceId: "ws_1",
    type: "PAYMENT_REVIEW",
    resourceType: "QUOTE",
    resourceId: "quote_1",
    severity: "WARNING",
    summary: "Payment needs manual review",
    createdAt: now,
  });
  assert.deepEqual(duplicateAttention, { ok: true, value: { item: existingAttention, created: false } });
  assert.equal(attentionInsertCalls, 0);

  const repositoryFailure = { ok: false as const, code: "LEDGER_INSERT_FAILED", message: "Database insert failed." };
  const failingRepo = {
    ...duplicateLedgerRepo,
    findLedgerByIdempotency: async () => undefined,
    insertLedgerEntry: async () => repositoryFailure,
  };
  const failedLedger = await appendLedgerEntryWithRepository(failingRepo, {
    workspaceId: "ws_1",
    resourceType: "VISIT",
    resourceId: "visit_1",
    direction: "CREDIT",
    amountMinor: 8_500,
    currency: "USD",
    idempotencyKey: "payment_evt_2",
    occurredAt: now,
  });
  assert.deepEqual(failedLedger, repositoryFailure);

  console.log("runtime-outage operations harness PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
