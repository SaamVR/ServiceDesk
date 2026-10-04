import type { CurrencyCode, InvoiceDTO, Result, VisitDTO } from "../contracts";
import type { AttentionItem, LedgerEntry, OutboxEvent } from "./operations";

export type PaymentPurpose = "DEPOSIT" | "BALANCE" | "PLATFORM_SUBSCRIPTION";
export type PaymentApplicationRecordState = "APPLIED" | "REVIEW";
export type PaymentReviewReasonCode =
  | "PAYMENT_EVENT_INVALID"
  | "PAYMENT_IDENTITY_CONFLICT"
  | "PAYMENT_PURPOSE_UNSUPPORTED"
  | "PAYMENT_TARGET_REQUIRED"
  | "PAYMENT_TARGET_NOT_FOUND"
  | "PAYMENT_WORKSPACE_MISMATCH"
  | "PAYMENT_QUOTE_NOT_ACCEPTED"
  | "PAYMENT_HOLD_MISMATCH"
  | "PAYMENT_HOLD_EXPIRED"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_CURRENCY_MISMATCH"
  | "PAYMENT_INVOICE_CLOSED";

export interface VerifiedPaymentFacts {
  provider: string;
  providerAccountId: string;
  providerEventId: string;
  providerTransactionId: string;
  purpose: PaymentPurpose;
  workspaceId: string;
  amountMinor: number;
  currency: CurrencyCode;
  occurredAt: string;
  quoteId?: string;
  holdId?: string;
  invoiceId?: string;
}

export interface InvoiceRecord {
  id: string;
  workspaceId: string;
  quoteId: string;
  visitId?: string;
  status: InvoiceDTO["status"];
  currency: CurrencyCode;
  totalMinor: number;
  allocatedMinor: number;
  refundedMinor: number;
  balanceMinor: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentApplicationRecord extends VerifiedPaymentFacts {
  id: string;
  state: PaymentApplicationRecordState;
  reasonCode?: PaymentReviewReasonCode;
  invoiceId?: string;
  visitId?: string;
  ledgerEntryId?: string;
  createdAt: string;
}

export interface PaymentApplicationMutationSet {
  application: PaymentApplicationRecord;
  invoice?: InvoiceRecord;
  visit?: VisitDTO;
  ledger?: LedgerEntry;
  outbox: OutboxEvent[];
  attention?: AttentionItem;
}

export function invoiceToDTO(invoice: InvoiceRecord): InvoiceDTO {
  return {
    id: invoice.id,
    workspaceId: invoice.workspaceId,
    visitId: invoice.visitId,
    status: invoice.status,
    currency: invoice.currency,
    totalMinor: invoice.totalMinor,
    allocatedMinor: invoice.allocatedMinor,
    refundedMinor: invoice.refundedMinor,
    balanceMinor: invoice.balanceMinor,
  };
}

export function validateVerifiedPaymentFacts(facts: VerifiedPaymentFacts): Result<true> {
  if (!facts.provider.trim() || !facts.providerAccountId.trim() || !facts.providerEventId.trim() || !facts.providerTransactionId.trim()) {
    return { ok: false, code: "PAYMENT_EVENT_INVALID", message: "Verified payment provider identity is required." };
  }
  if (!facts.workspaceId.trim()) return { ok: false, code: "PAYMENT_EVENT_INVALID", message: "Verified payment workspace is required." };
  if (!Number.isInteger(facts.amountMinor) || facts.amountMinor <= 0) return { ok: false, code: "PAYMENT_EVENT_INVALID", message: "Verified payment amount must be a positive integer." };
  if (!facts.currency.trim()) return { ok: false, code: "PAYMENT_EVENT_INVALID", message: "Verified payment currency is required." };
  if (!Number.isFinite(new Date(facts.occurredAt).getTime())) return { ok: false, code: "PAYMENT_EVENT_INVALID", message: "Verified payment timestamp must be valid." };
  return { ok: true, value: true };
}

export function sameMaterialPaymentFacts(left: VerifiedPaymentFacts, right: VerifiedPaymentFacts): boolean {
  return left.provider === right.provider
    && left.providerAccountId === right.providerAccountId
    && left.providerEventId === right.providerEventId
    && left.providerTransactionId === right.providerTransactionId
    && left.purpose === right.purpose
    && left.workspaceId === right.workspaceId
    && left.amountMinor === right.amountMinor
    && left.currency === right.currency
    && left.quoteId === right.quoteId
    && left.holdId === right.holdId
    && left.invoiceId === right.invoiceId;
}

export function allocateInvoicePayment(invoice: InvoiceRecord, amountMinor: number, now: string): Result<InvoiceRecord> {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return { ok: false, code: "PAYMENT_AMOUNT_MISMATCH", message: "Payment amount must be positive." };
  if (invoice.status === "VOID" || invoice.status === "PAID") return { ok: false, code: "PAYMENT_INVOICE_CLOSED", message: "Invoice is not open for payment application." };
  if (amountMinor > invoice.balanceMinor) return { ok: false, code: "PAYMENT_AMOUNT_MISMATCH", message: "Payment amount exceeds invoice balance." };
  const allocatedMinor = invoice.allocatedMinor + amountMinor;
  const balanceMinor = invoice.totalMinor - allocatedMinor + invoice.refundedMinor;
  return {
    ok: true,
    value: { ...invoice, allocatedMinor, balanceMinor, status: balanceMinor === 0 ? "PAID" : "PARTIALLY_PAID", version: invoice.version + 1, updatedAt: now },
  };
}
