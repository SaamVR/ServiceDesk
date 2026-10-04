import type { Result, VisitDTO } from "../../contracts";
import type { CapacitySlot, SlotHold } from "../../domain/capacity";
import type { AttentionItem, LedgerEntry, OutboxEvent } from "../../domain/operations";
import type { InvoiceRecord, PaymentApplicationRecord, PaymentPurpose } from "../../domain/payments";
import type { QuoteSnapshot } from "../../domain/quote";

export interface PaymentApplicationUnitOfWork {
  nextPaymentApplicationId(): string;
  nextInvoiceId(): string;
  nextVisitId(): string;
  nextLedgerId(): string;
  nextOutboxId(): string;
  nextAttentionId(): string;

  findApplicationByProviderEvent(provider: string, providerAccountId: string, providerEventId: string): Promise<PaymentApplicationRecord | undefined>;
  findApplicationByTransaction(workspaceId: string, providerAccountId: string, providerTransactionId: string, purpose: PaymentPurpose): Promise<PaymentApplicationRecord | undefined>;
  insertPaymentApplication(application: PaymentApplicationRecord): Promise<Result<PaymentApplicationRecord>>;

  findQuoteById(workspaceId: string, quoteId: string): Promise<QuoteSnapshot | undefined>;
  findHoldById(workspaceId: string, holdId: string): Promise<SlotHold | undefined>;
  findSlotById(workspaceId: string, slotId: string): Promise<CapacitySlot | undefined>;
  confirmHold(workspaceId: string, holdId: string): Promise<Result<SlotHold>>;

  findInvoiceById(workspaceId: string, invoiceId: string): Promise<InvoiceRecord | undefined>;
  findInvoiceByQuoteId(workspaceId: string, quoteId: string): Promise<InvoiceRecord | undefined>;
  upsertInvoice(invoice: InvoiceRecord): Promise<Result<InvoiceRecord>>;

  findVisitByQuoteId(workspaceId: string, quoteId: string): Promise<VisitDTO | undefined>;
  insertVisit(visit: VisitDTO): Promise<Result<VisitDTO>>;

  appendLedgerEntry(entry: LedgerEntry): Promise<Result<LedgerEntry>>;
  enqueueOutbox(event: OutboxEvent): Promise<Result<OutboxEvent>>;
  raiseAttentionItem(item: AttentionItem): Promise<Result<AttentionItem>>;
}

export interface PaymentApplicationRepository {
  transaction<T>(operation: (unitOfWork: PaymentApplicationUnitOfWork) => Promise<Result<T>>): Promise<Result<T>>;
}
