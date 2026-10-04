import type { Result, VisitDTO } from "../../contracts";
import type { AttentionItem, LedgerEntry, OutboxEvent } from "../../domain/operations";
import { allocateInvoicePayment, invoiceToDTO, validateVerifiedPaymentFacts, type InvoiceRecord, type PaymentApplicationRecord, type PaymentReviewReasonCode, type VerifiedPaymentFacts } from "../../domain/payments";
import type { QuoteSnapshot } from "../../domain/quote";
import type { VerifiedPaymentApplicationOutcome, VerifiedPaymentEvent } from "./facade";
import type { PaymentApplicationRepository, PaymentApplicationUnitOfWork } from "./payment-application-repository";

const appKey = (event: VerifiedPaymentFacts) => `${event.provider}:${event.providerAccountId}:${event.providerEventId}`;
const fail = (code: string, message: string): Result<never> => ({ ok: false, code, message });

function appFacts(application: PaymentApplicationRecord): VerifiedPaymentFacts {
  return { provider: application.provider, providerAccountId: application.providerAccountId, providerEventId: application.providerEventId, providerTransactionId: application.providerTransactionId, purpose: application.purpose, workspaceId: application.workspaceId, amountMinor: application.amountMinor, currency: application.currency, occurredAt: application.occurredAt, quoteId: application.quoteId, holdId: application.holdId, invoiceId: application.invoiceId };
}

function sameForTransaction(left: VerifiedPaymentFacts, right: VerifiedPaymentFacts): boolean {
  return left.provider === right.provider && left.providerAccountId === right.providerAccountId && left.providerTransactionId === right.providerTransactionId && left.purpose === right.purpose && left.workspaceId === right.workspaceId && left.amountMinor === right.amountMinor && left.currency === right.currency && left.quoteId === right.quoteId && left.holdId === right.holdId && (left.purpose !== "BALANCE" || left.invoiceId === right.invoiceId);
}

async function existingOutcome(unit: PaymentApplicationUnitOfWork, event: VerifiedPaymentFacts): Promise<Result<VerifiedPaymentApplicationOutcome> | undefined> {
  const byEvent = await unit.findApplicationByProviderEvent(event.provider, event.providerAccountId, event.providerEventId);
  if (byEvent) return sameForTransaction(event, appFacts(byEvent)) ? { ok: true, value: { state: "DUPLICATE" } } : review(unit, event, "PAYMENT_IDENTITY_CONFLICT");
  const byTxn = await unit.findApplicationByTransaction(event.workspaceId, event.providerAccountId, event.providerTransactionId, event.purpose);
  if (byTxn) return sameForTransaction(event, appFacts(byTxn)) ? { ok: true, value: { state: "DUPLICATE" } } : review(unit, event, "PAYMENT_IDENTITY_CONFLICT");
  return undefined;
}

async function review(unit: PaymentApplicationUnitOfWork, event: VerifiedPaymentFacts, reasonCode: PaymentReviewReasonCode): Promise<Result<VerifiedPaymentApplicationOutcome>> {
  const existing = await unit.findApplicationByProviderEvent(event.provider, event.providerAccountId, event.providerEventId) ?? await unit.findApplicationByTransaction(event.workspaceId, event.providerAccountId, event.providerTransactionId, event.purpose);
  if (!existing) {
    const inserted = await unit.insertPaymentApplication({ id: unit.nextPaymentApplicationId(), ...event, state: "REVIEW", reasonCode, createdAt: event.occurredAt });
    if (inserted.ok === false) return inserted;
  }
  const attention: AttentionItem = { id: unit.nextAttentionId(), workspaceId: event.workspaceId, type: "PAYMENT_REVIEW", resourceType: "PAYMENT_APPLICATION", resourceId: appKey(event), severity: "WARNING", status: "OPEN", summary: `Payment requires review: ${reasonCode}`, createdAt: event.occurredAt };
  const raised = await unit.raiseAttentionItem(attention);
  if (raised.ok === false) return raised;
  return { ok: true, value: { state: "PAYMENT_REVIEW", attentionItemId: raised.value.id } };
}

function newInvoice(unit: PaymentApplicationUnitOfWork, quote: QuoteSnapshot, now: string): InvoiceRecord {
  return { id: unit.nextInvoiceId(), workspaceId: quote.workspaceId, quoteId: quote.id, status: "ISSUED", currency: quote.currency, totalMinor: quote.totalMinor, allocatedMinor: 0, refundedMinor: 0, balanceMinor: quote.totalMinor, version: 1, createdAt: now, updatedAt: now };
}

function ledger(unit: PaymentApplicationUnitOfWork, event: VerifiedPaymentFacts, invoiceId: string): LedgerEntry {
  return { id: unit.nextLedgerId(), workspaceId: event.workspaceId, resourceType: "INVOICE", resourceId: invoiceId, direction: "CREDIT", amountMinor: event.amountMinor, currency: event.currency, idempotencyKey: `payment:${appKey(event)}:ledger`, occurredAt: event.occurredAt };
}

function outbox(unit: PaymentApplicationUnitOfWork, event: VerifiedPaymentFacts, topic: string, payload: Record<string, unknown>): OutboxEvent {
  return { id: unit.nextOutboxId(), workspaceId: event.workspaceId, topic, payload, status: "PENDING", attempts: 0, idempotencyKey: `payment:${appKey(event)}:${topic}`, createdAt: event.occurredAt };
}

async function applyDeposit(unit: PaymentApplicationUnitOfWork, event: VerifiedPaymentFacts): Promise<Result<VerifiedPaymentApplicationOutcome>> {
  if (!event.quoteId || !event.holdId) return review(unit, event, "PAYMENT_TARGET_REQUIRED");
  const quote = await unit.findQuoteById(event.workspaceId, event.quoteId);
  const hold = await unit.findHoldById(event.workspaceId, event.holdId);
  if (!quote || !hold) return review(unit, event, "PAYMENT_TARGET_NOT_FOUND");
  if (quote.workspaceId !== event.workspaceId || hold.workspaceId !== event.workspaceId) return review(unit, event, "PAYMENT_WORKSPACE_MISMATCH");
  if (quote.status !== "ACCEPTED") return review(unit, event, "PAYMENT_QUOTE_NOT_ACCEPTED");
  if (hold.quoteId !== quote.id) return review(unit, event, "PAYMENT_HOLD_MISMATCH");
  if (event.currency !== quote.currency) return review(unit, event, "PAYMENT_CURRENCY_MISMATCH");
  if (event.amountMinor !== quote.depositMinor) return review(unit, event, "PAYMENT_AMOUNT_MISMATCH");
  if (new Date(event.occurredAt).getTime() > new Date(hold.expiresAt).getTime()) return review(unit, event, "PAYMENT_HOLD_EXPIRED");
  const slot = await unit.findSlotById(event.workspaceId, hold.slotId);
  if (!slot) return review(unit, event, "PAYMENT_TARGET_NOT_FOUND");
  const invoice = await unit.findInvoiceByQuoteId(event.workspaceId, quote.id) ?? newInvoice(unit, quote, event.occurredAt);
  const allocated = allocateInvoicePayment(invoice, event.amountMinor, event.occurredAt);
  if (allocated.ok === false) return review(unit, event, allocated.code as PaymentReviewReasonCode);
  const confirmed = await unit.confirmHold(event.workspaceId, hold.id);
  if (confirmed.ok === false) return confirmed;
  const existingVisit = await unit.findVisitByQuoteId(event.workspaceId, quote.id);
  const visit: VisitDTO = existingVisit ?? { id: unit.nextVisitId(), workspaceId: event.workspaceId, requestId: quote.requestId, quoteId: quote.id, crewId: slot.crewId, status: "CONFIRMED", startAt: slot.startsAt, serviceMinutes: quote.durationMinutes, bufferMinutes: quote.bufferMinutes, version: 1 };
  const visitResult = existingVisit ? { ok: true as const, value: existingVisit } : await unit.insertVisit(visit);
  if (visitResult.ok === false) return visitResult;
  const saved = await unit.upsertInvoice({ ...allocated.value, visitId: visitResult.value.id });
  if (saved.ok === false) return saved;
  const credited = await unit.appendLedgerEntry(ledger(unit, event, saved.value.id));
  if (credited.ok === false) return credited;
  for (const next of [outbox(unit, event, "booking.confirmed", { quoteId: quote.id, visitId: visitResult.value.id, holdId: confirmed.value.id }), outbox(unit, event, "payment.received", { invoiceId: saved.value.id, amountMinor: event.amountMinor })]) {
    const queued = await unit.enqueueOutbox(next);
    if (queued.ok === false) return queued;
  }
  const inserted = await unit.insertPaymentApplication({ id: unit.nextPaymentApplicationId(), ...event, invoiceId: saved.value.id, visitId: visitResult.value.id, ledgerEntryId: credited.value.id, state: "APPLIED", createdAt: event.occurredAt });
  if (inserted.ok === false) return inserted;
  return { ok: true, value: { state: "APPLIED", invoice: invoiceToDTO(saved.value), visit: visitResult.value } };
}

async function applyBalance(unit: PaymentApplicationUnitOfWork, event: VerifiedPaymentFacts): Promise<Result<VerifiedPaymentApplicationOutcome>> {
  if (!event.invoiceId) return review(unit, event, "PAYMENT_TARGET_REQUIRED");
  const invoice = await unit.findInvoiceById(event.workspaceId, event.invoiceId);
  if (!invoice) return review(unit, event, "PAYMENT_TARGET_NOT_FOUND");
  if (invoice.workspaceId !== event.workspaceId) return review(unit, event, "PAYMENT_WORKSPACE_MISMATCH");
  if (invoice.status === "VOID" || invoice.status === "PAID") return review(unit, event, "PAYMENT_INVOICE_CLOSED");
  if (event.currency !== invoice.currency) return review(unit, event, "PAYMENT_CURRENCY_MISMATCH");
  if (event.amountMinor !== invoice.balanceMinor) return review(unit, event, "PAYMENT_AMOUNT_MISMATCH");
  const allocated = allocateInvoicePayment(invoice, event.amountMinor, event.occurredAt);
  if (allocated.ok === false) return review(unit, event, allocated.code as PaymentReviewReasonCode);
  const saved = await unit.upsertInvoice(allocated.value);
  if (saved.ok === false) return saved;
  const credited = await unit.appendLedgerEntry(ledger(unit, event, saved.value.id));
  if (credited.ok === false) return credited;
  const queued = await unit.enqueueOutbox(outbox(unit, event, "payment.receipt", { invoiceId: saved.value.id, amountMinor: event.amountMinor }));
  if (queued.ok === false) return queued;
  const inserted = await unit.insertPaymentApplication({ id: unit.nextPaymentApplicationId(), ...event, invoiceId: saved.value.id, ledgerEntryId: credited.value.id, state: "APPLIED", createdAt: event.occurredAt });
  if (inserted.ok === false) return inserted;
  return { ok: true, value: { state: "APPLIED", invoice: invoiceToDTO(saved.value) } };
}

export async function applyVerifiedPaymentWithRepository(repository: PaymentApplicationRepository, event: VerifiedPaymentEvent): Promise<Result<VerifiedPaymentApplicationOutcome>> {
  const facts: VerifiedPaymentFacts = event;
  const valid = validateVerifiedPaymentFacts(facts);
  if (valid.ok === false) return fail(valid.code, valid.message);
  return repository.transaction(async (unit) => {
    const duplicate = await existingOutcome(unit, facts);
    if (duplicate) return duplicate;
    if (facts.purpose === "DEPOSIT") return applyDeposit(unit, facts);
    if (facts.purpose === "BALANCE") return applyBalance(unit, facts);
    return review(unit, facts, "PAYMENT_PURPOSE_UNSUPPORTED");
  });
}
