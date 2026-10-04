import type { ActorContext, CommandMeta, InvoiceDTO, QuoteDTO, RequestDTO, Result, SlotDTO, VisitDTO } from "../../contracts";
export interface CreateRequestInput { customerId?: string; propertyId?: string; serviceCode?: string; }
export interface FindSlotsInput { requestId: string; from: string; to: string; preferredCrewId?: string; }
export interface VerifiedPaymentEvent {
  provider: string; providerAccountId: string; providerEventId: string; providerTransactionId: string;
  purpose: "DEPOSIT" | "BALANCE" | "PLATFORM_SUBSCRIPTION"; workspaceId: string; amountMinor: number; currency: string; occurredAt: string;
  quoteId?: string; holdId?: string; invoiceId?: string;
}
export type VerifiedPaymentApplicationState = "APPLIED" | "DUPLICATE" | "PAYMENT_REVIEW";
export interface VerifiedPaymentApplicationOutcome {
  state: VerifiedPaymentApplicationState;
  visit?: VisitDTO;
  invoice?: InvoiceDTO;
  attentionItemId?: string;
}
export type VisitAction = "CONFIRM" | "ASSIGN" | "EN_ROUTE" | "START" | "SUBMIT_REVIEW" | "COMPLETE" | "CANCEL";
export interface WorkspaceSnapshotQuery { customerId?: string; requestId?: string; visitId?: string; invoiceId?: string; }
export interface WorkspaceSnapshot { requests: RequestDTO[]; quotes: QuoteDTO[]; visits: VisitDTO[]; invoices: InvoiceDTO[]; }
export interface ServiceDeskFacade {
  createRequest(ctx: ActorContext, input: CreateRequestInput, meta: CommandMeta): Promise<Result<RequestDTO>>;
  updateRequest(ctx: ActorContext, id: string, patch: Partial<RequestDTO>, meta: CommandMeta): Promise<Result<RequestDTO>>;
  calculateQuote(ctx: ActorContext, id: string): Promise<Result<QuoteDTO>>;
  sendQuote(ctx: ActorContext, id: string, meta: CommandMeta): Promise<Result<QuoteDTO>>;
  findSlots(ctx: ActorContext, input: FindSlotsInput): Promise<SlotDTO[]>;
  holdSlot(ctx: ActorContext, slotId: string, quoteId: string, meta: CommandMeta): Promise<Result<{holdId:string;expiresAt:string}>>;
  applyVerifiedPayment(event: VerifiedPaymentEvent): Promise<Result<VerifiedPaymentApplicationOutcome>>;
  transitionVisit(ctx: ActorContext, id: string, action: VisitAction, meta: CommandMeta): Promise<Result<VisitDTO>>;
  readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery): Promise<Result<WorkspaceSnapshot>>;
}
