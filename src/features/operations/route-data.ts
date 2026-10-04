import type { AttentionItemDTO, ConversationDTO, IntegrationStatusDTO, InvoiceDTO, MessageDTO, QualityCaseDTO, QuoteDTO, RequestDTO, SlotDTO, VisitDTO } from "@/contracts";
import type { CheckoutProviderMode } from "@/features/checkout/view-models";
import type { InboxActionAvailability } from "@/features/inbox/view-models";
import type { CrewTransitionPresentation } from "@/features/crew/server-boundary";
import type { ManualPaymentAvailability } from "@/features/invoices/server-boundary";
import type { QualityActionAvailability } from "@/features/quality/view-models";
import type { BusinessModule } from "./business-modules";
import type { CrewModule } from "./crew-modules";
import type { CustomerModule } from "./customer-modules";
import type { StaffModule } from "./staff-modules";
export type OperationalSurface = "business" | "customer" | "staff" | "crew" | "onboarding" | "tour";
export interface EnquiryFormSnapshot { serviceLabel: string; bedroomsLabel: string; bathroomsLabel: string; requestedStartLabel: string; modeLabel?: string; boundaryNotice?: string; }
export interface RequestSummarySnapshot { request: RequestDTO; quote: QuoteDTO; }
export interface CheckoutSnapshot { quote: QuoteDTO; slot: SlotDTO; visit: VisitDTO; invoice: InvoiceDTO; paymentMode: CheckoutProviderMode; holdExpiresAt: string; }
export interface CustomerPortalSnapshot { request: RequestDTO; quote: QuoteDTO; slot: SlotDTO; visit: VisitDTO; invoice: InvoiceDTO; conversation: ConversationDTO; }
export interface StaffQueueSnapshot { request: RequestDTO; quote?: QuoteDTO; conversation?: ConversationDTO; attentionItems: AttentionItemDTO[]; integrations: IntegrationStatusDTO[]; }
export interface InboxSnapshot { conversation: ConversationDTO; messages: MessageDTO[]; customerLabel: string; requestLabel: string; actionAvailability?: InboxActionAvailability; }
export interface CrmSnapshot { request: RequestDTO; quote: QuoteDTO; visit: VisitDTO; invoice: InvoiceDTO; conversation: ConversationDTO; }
export interface QuoteApprovalSnapshot { request: RequestDTO; currentQuote: QuoteDTO; previousQuote?: QuoteDTO; }
export interface ScheduleSnapshot { slot: SlotDTO; visit?: VisitDTO; integrations: IntegrationStatusDTO[]; attentionItems: AttentionItemDTO[]; }
export interface StaffInvoiceSnapshot { invoice: InvoiceDTO; manualPaymentAvailability: ManualPaymentAvailability; }
export interface QualitySnapshot { qualityCase: QualityCaseDTO; visit: VisitDTO; attentionItems: AttentionItemDTO[]; actionAvailability?: QualityActionAvailability; }
export interface RecoverySnapshot { attentionItems: AttentionItemDTO[]; integrations: IntegrationStatusDTO[]; invoice?: InvoiceDTO; visit?: VisitDTO; qualityCase?: QualityCaseDTO; }
export interface CrewTodaySnapshot { request: RequestDTO; visit: VisitDTO; }
export interface CrewJobSnapshot { request: RequestDTO; visit: VisitDTO; invoice: InvoiceDTO; transition?: CrewTransitionPresentation; }
export interface OperationalRouteData { sourceLabel: "SERVER_SNAPSHOT" | "FIXTURE_UI_ONLY"; navigation: { quoteId: string; bookingId: string; invoiceId: string; visitId: string }; business: { enquiry: { form: EnquiryFormSnapshot; summary: RequestSummarySnapshot }; checkout: CheckoutSnapshot }; customer: { overview: CustomerPortalSnapshot; checkout: CheckoutSnapshot; invoice: InvoiceDTO; invoicePaymentAvailability?: ManualPaymentAvailability }; staff: { attention: StaffQueueSnapshot; inbox: InboxSnapshot; crm: CrmSnapshot; requestSummary: RequestSummarySnapshot; quoteApproval: QuoteApprovalSnapshot; schedule: ScheduleSnapshot; jobsVisit: VisitDTO; selectedInvoice?: StaffInvoiceSnapshot; quality?: QualitySnapshot; recovery?: RecoverySnapshot; }; crew: { today: CrewTodaySnapshot; job: CrewJobSnapshot } }
export interface OperationalRoutePropsBase { surface: OperationalSurface; title: string; description: string; workspaceLabel?: string; resourceLabel?: string; businessModule?: BusinessModule; businessSlug?: string; crewModule?: CrewModule; customerModule?: CustomerModule; staffModule?: StaffModule; }
