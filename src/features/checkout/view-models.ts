import type { InvoiceDTO, QuoteDTO, SlotDTO, VisitDTO } from "@/contracts";

export type CheckoutProviderMode = "FIXTURE" | "SANDBOX" | "LIVE";

interface CheckoutViewInput {
  quote: QuoteDTO;
  slot: SlotDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
  paymentMode: CheckoutProviderMode;
  holdExpiresAt: string;
}

export interface CheckoutView {
  quoteState: string;
  slotState: string;
  paymentState: string;
  visitState: string;
  holdLabel: string;
  depositLabel: string;
  balanceLabel: string;
  primaryAction: string;
  canShowReceipt: boolean;
  warning: string;
}

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);

export function buildCheckoutView({ quote, slot, visit, invoice, paymentMode, holdExpiresAt }: CheckoutViewInput): CheckoutView {
  const isSandbox = paymentMode !== "LIVE";
  const depositRecorded = invoice.allocatedMinor >= quote.depositMinor;
  const hasReview = visit.status === "PAYMENT_REVIEW";

  const quoteState = quote.status === "ACCEPTED"
    ? `Quote accepted · version ${quote.version}`
    : quote.status === "EXPIRED"
      ? `Quote expired · version ${quote.version}`
      : `Quote ${quote.status.toLowerCase().replaceAll("_", " ")} · version ${quote.version}`;

  const slotState = slot.availabilityFresh ? "Fresh slot on hold" : "Calendar stale · staff review required";

  const paymentState = hasReview
    ? "Payment needs reconciliation"
    : depositRecorded
      ? `${paymentMode === "LIVE" ? "Live" : paymentMode === "SANDBOX" ? "Sandbox" : "Fixture"} checkout · deposit recorded`
      : `${paymentMode === "LIVE" ? "Live" : paymentMode === "SANDBOX" ? "Sandbox" : "Fixture"} checkout · deposit pending`;

  const visitState = hasReview
    ? "Payment review required"
    : visit.status === "CONFIRMED" || visit.status === "ASSIGNED"
      ? `Visit ${visit.status.toLowerCase()}`
      : "Awaiting payment before confirmation";

  const primaryAction = hasReview
    ? "Open payment review"
    : !slot.availabilityFresh
      ? "Ask staff to refresh availability"
      : depositRecorded && (visit.status === "CONFIRMED" || visit.status === "ASSIGNED")
        ? "View confirmed visit"
        : "Continue sandbox checkout";

  const warning = isSandbox
    ? "This checkout state is sandbox or fixture data. Do not show a paid receipt until a verified provider callback exists."
    : "Live payment mode still requires provider callback evidence before showing receipt proof.";

  return {
    quoteState,
    slotState,
    paymentState,
    visitState,
    holdLabel: `Hold expires ${holdExpiresAt}`,
    depositLabel: money(quote.depositMinor, quote.currency),
    balanceLabel: money(quote.balanceMinor, quote.currency),
    primaryAction,
    canShowReceipt: paymentMode === "LIVE" && depositRecorded && !hasReview,
    warning,
  };
}
