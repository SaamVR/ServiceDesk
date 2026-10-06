import type { ActorContext, AttentionItemDTO, CommandMeta, ConversationDTO, InvoiceDTO, MessageDTO, OwnerSettingsSnapshotDTO, PlatformBillingSnapshotDTO, QualityCaseDTO, QuoteDTO, RecurrenceFrequency, RecurrenceRuleDTO, ReportingSnapshotDTO, RequestDTO, Result, SlotDTO, VisitChecklistItemDTO, VisitDTO, VisitEvidenceDTO, VisitEvidenceKind } from "../../contracts";
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
export interface InboundMessageEvent {
  receiptKey: string;
  workspaceId: string;
  channel: "WHATSAPP" | "EMAIL";
  providerAccountId: string;
  providerMessageId: string;
  senderRef: string;
  occurredAt: string;
  contentKind: "TEXT" | "MEDIA_REFERENCE" | "UNSUPPORTED";
  text?: string;
  media?: { provider: "WHATSAPP"; providerMediaId: string };
  rawProviderEventRef: string;
}
export interface InboundMessageApplicationOutcome {
  state: "APPLIED" | "DUPLICATE";
  conversation: ConversationDTO;
  message?: MessageDTO;
}
export interface ConversationHandoverInput { active: boolean; assignedUserId?: string; }
export interface ConversationReplyInput { body: string; channel: "WHATSAPP" | "EMAIL"; }
export interface ConversationReplyOutcome { message: MessageDTO; outboxEventId: string; }
export interface AddVisitEvidenceInput {
  kind: VisitEvidenceKind;
  mediaReference?: { storageProvider: string; objectRef: string; mimeType?: string };
  text?: string;
  capturedAt: string;
}
export interface SetVisitChecklistItemInput { itemKey: string; completed: boolean; note?: string; }
export interface AssignCrewInput { crewId: string; }
export interface CreateRecurrenceRuleInput {
  requestId: string;
  propertyId: string;
  frequency: RecurrenceFrequency;
  timezone: string;
  localStartTime: string;
  startsOn: string;
  endsOn?: string;
  maxOccurrences?: number;
}
export type RecurrenceRuleAction = "PAUSE" | "RESUME" | "SKIP_NEXT";
export interface ManualPaymentInput {
  amountMinor: number;
  currency: string;
  method: "CASH" | "BANK_TRANSFER" | "OTHER";
  reference: string;
  occurredAt: string;
}
export type QualityCaseAction = "START_REVIEW" | "ASSIGN" | "RESOLVE" | "REQUEST_REVIEW";
export interface QualityCaseActionInput {
  ownerUserId?: string;
  resolutionNote?: string;
}
export type VisitAction = "CONFIRM" | "ASSIGN" | "EN_ROUTE" | "START" | "SUBMIT_REVIEW" | "COMPLETE" | "CANCEL";
export interface WorkspaceSnapshotQuery { customerId?: string; requestId?: string; visitId?: string; invoiceId?: string; conversationId?: string; }
export interface ReportingSnapshotQuery { from?: string; to?: string; }
export interface WorkspaceSnapshot { requests: RequestDTO[]; quotes: QuoteDTO[]; visits: VisitDTO[]; invoices: InvoiceDTO[]; conversations: ConversationDTO[]; messages: MessageDTO[]; recurrenceRules: RecurrenceRuleDTO[]; visitEvidence: VisitEvidenceDTO[]; visitChecklistItems: VisitChecklistItemDTO[]; attentionItems: AttentionItemDTO[]; qualityCases: QualityCaseDTO[]; }
export interface ServiceDeskFacade {
  createRequest(ctx: ActorContext, input: CreateRequestInput, meta: CommandMeta): Promise<Result<RequestDTO>>;
  updateRequest(ctx: ActorContext, id: string, patch: Partial<RequestDTO>, meta: CommandMeta): Promise<Result<RequestDTO>>;
  calculateQuote(ctx: ActorContext, id: string): Promise<Result<QuoteDTO>>;
  sendQuote(ctx: ActorContext, id: string, meta: CommandMeta): Promise<Result<QuoteDTO>>;
  acceptQuote(ctx: ActorContext, id: string, meta: CommandMeta): Promise<Result<QuoteDTO>>;
  findSlots(ctx: ActorContext, input: FindSlotsInput): Promise<SlotDTO[]>;
  holdSlot(ctx: ActorContext, slotId: string, quoteId: string, meta: CommandMeta): Promise<Result<{holdId:string;expiresAt:string}>>;
  applyVerifiedPayment(event: VerifiedPaymentEvent): Promise<Result<VerifiedPaymentApplicationOutcome>>;
  applyInboundMessage(event: InboundMessageEvent): Promise<Result<InboundMessageApplicationOutcome>>;
  setConversationHandover(ctx: ActorContext, id: string, input: ConversationHandoverInput, meta: CommandMeta): Promise<Result<ConversationDTO>>;
  enqueueConversationReply(ctx: ActorContext, id: string, input: ConversationReplyInput, meta: CommandMeta): Promise<Result<ConversationReplyOutcome>>;
  transitionVisit(ctx: ActorContext, id: string, action: VisitAction, meta: CommandMeta): Promise<Result<VisitDTO>>;
  assignCrew(ctx: ActorContext, id: string, input: AssignCrewInput, meta: CommandMeta): Promise<Result<VisitDTO>>;
  addVisitEvidence(ctx: ActorContext, visitId: string, input: AddVisitEvidenceInput, meta: CommandMeta): Promise<Result<VisitEvidenceDTO>>;
  setVisitChecklistItem(ctx: ActorContext, visitId: string, input: SetVisitChecklistItemInput, meta: CommandMeta): Promise<Result<VisitChecklistItemDTO>>;
  createRecurrenceRule(ctx: ActorContext, input: CreateRecurrenceRuleInput, meta: CommandMeta): Promise<Result<RecurrenceRuleDTO>>;
  applyRecurrenceRuleAction(ctx: ActorContext, id: string, action: RecurrenceRuleAction, meta: CommandMeta): Promise<Result<RecurrenceRuleDTO>>;
  applyManualPayment(ctx: ActorContext, invoiceId: string, input: ManualPaymentInput, meta: CommandMeta): Promise<Result<InvoiceDTO>>;
  applyQualityCaseAction(ctx: ActorContext, id: string, action: QualityCaseAction, input: QualityCaseActionInput, meta: CommandMeta): Promise<Result<QualityCaseDTO>>;
  readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery): Promise<Result<WorkspaceSnapshot>>;
  readReportingSnapshot(ctx: ActorContext, query: ReportingSnapshotQuery): Promise<Result<ReportingSnapshotDTO>>;
  readPlatformBillingSnapshot(ctx: ActorContext): Promise<Result<PlatformBillingSnapshotDTO>>;
  readOwnerSettingsSnapshot(ctx: ActorContext): Promise<Result<OwnerSettingsSnapshotDTO>>;
}
