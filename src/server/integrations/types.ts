import type { ActorContext, CommandMeta, QuoteDTO, Result, VisitDTO } from "../../contracts";
import type { VerifiedPaymentEvent } from "../core/facade";

export type ProviderMode = "FIXTURE" | "SANDBOX" | "LIVE";
export type ProviderVerificationState = "CONTRACT_TESTED" | "PROVIDER_VERIFIED" | "CONFIGURATION_BLOCKED";
export type DeliveryChannel = "WHATSAPP" | "EMAIL" | "WEBHOOK";
export type DeliveryPurpose = "QUOTE" | "CONFIRMATION" | "REMINDER" | "INVOICE" | "FEEDBACK" | "STAFF_ALERT";

export interface RedactedProviderEvidence {
  provider: "WHATSAPP" | "GOOGLE_CALENDAR" | "PAYMENT" | "EMAIL" | "WEBHOOK" | "AI";
  mode: ProviderMode;
  verification: ProviderVerificationState;
  capturedAt: string;
  controlledId?: string;
  redactedReceipt?: string;
  notes: string[];
}

export interface RecipientPolicy {
  recipientRef: string;
  consentRequired: boolean;
  hasOptIn: boolean;
  optedOut: boolean;
  quietHoursBlocked?: boolean;
}

export interface HandoverGuard {
  conversationId: string;
  expectedConversationVersion: number;
  handoverActive: boolean;
}

export interface OutboxJob {
  id: string;
  workspaceId: string;
  channel: DeliveryChannel;
  purpose: DeliveryPurpose;
  recipient: RecipientPolicy;
  createdAt: string;
  idempotencyKey: string;
  handoverGuard?: HandoverGuard;
  templateKey?: string;
  freeformText?: string;
  payload: Record<string, unknown>;
}

export interface ProviderSendResult {
  jobId: string;
  providerMessageId: string;
  acceptedAt: string;
  mode: ProviderMode;
  evidence: RedactedProviderEvidence;
}

export interface MessagingAdapter {
  send(outboxJob: OutboxJob): Promise<Result<ProviderSendResult>>;
}

export interface CalendarBusyRange {
  calendarId: string;
  startAt: string;
  endAt: string;
  source: "APP_MANAGED" | "EXTERNAL_BUSY";
  freshness: "FRESH" | "STALE";
}

export interface CalendarSyncState {
  workspaceId: string;
  crewId: string;
  calendarId: string;
  syncToken?: string;
  lastSyncedAt?: string;
  stale: boolean;
}

export interface CalendarAdapter {
  createOrUpdate(visit: VisitDTO): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>>;
  cancel(visit: VisitDTO, meta: CommandMeta): Promise<Result<{ providerEventId: string; evidence: RedactedProviderEvidence }>>;
  listBusy(range: { from: string; to: string }, crewId: string): Promise<Result<CalendarBusyRange[]>>;
  recoverSync(state: CalendarSyncState): Promise<Result<CalendarSyncState>>;
}

export interface CheckoutInput {
  hold: { holdId: string; workspaceId: string; quoteId: string; expiresAt: string };
  quote: QuoteDTO;
  purpose: "DEPOSIT" | "BALANCE" | "PLATFORM_SUBSCRIPTION";
  successUrl: string;
  cancelUrl: string;
  invoiceId?: string;
}

export interface CheckoutSession {
  provider: "STRIPE" | "FIXTURE";
  providerSessionId: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: string;
  mode: ProviderMode;
  metadata?: Record<string, string>;
  evidence: RedactedProviderEvidence;
}

export interface VerifiedPaymentWebhook {
  event: VerifiedPaymentEvent;
  evidence: RedactedProviderEvidence;
}

export interface PaymentAdapter {
  createCheckout(input: CheckoutInput): Promise<Result<CheckoutSession>>;
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<Result<VerifiedPaymentWebhook>>;
}

export interface ProviderConfigurationCheck {
  provider: RedactedProviderEvidence["provider"];
  mode: ProviderMode;
  status: ProviderVerificationState;
  requiredConfiguration: string[];
  evidence: RedactedProviderEvidence;
}

export function blockedConfiguration(
  provider: RedactedProviderEvidence["provider"],
  requiredConfiguration: string[],
  now: string,
  mode: ProviderMode = "SANDBOX",
): ProviderConfigurationCheck {
  return {
    provider,
    mode,
    status: "CONFIGURATION_BLOCKED",
    requiredConfiguration,
    evidence: {
      provider,
      mode,
      verification: "CONFIGURATION_BLOCKED",
      capturedAt: now,
      notes: requiredConfiguration,
    },
  };
}

export function hasRecipientSuppression(job: OutboxJob): string | null {
  if (job.recipient.optedOut) return "RECIPIENT_OPTED_OUT";
  if (job.recipient.consentRequired && !job.recipient.hasOptIn) return "MISSING_OPT_IN";
  if (job.recipient.quietHoursBlocked) return "QUIET_HOURS";
  if (job.handoverGuard?.handoverActive) return "HUMAN_HANDOVER_ACTIVE";
  return null;
}

export function ensureTenant(ctx: ActorContext, workspaceId: string): Result<true> {
  if (ctx.workspaceId !== workspaceId) {
    return { ok: false, code: "WORKSPACE_MISMATCH", message: "Provider action workspace does not match actor context." };
  }
  return { ok: true, value: true };
}
