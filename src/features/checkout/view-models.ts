import type { InvoiceDTO, QuoteDTO, SlotDTO, VisitDTO } from "@/contracts";
import type { HeldSlotOutcome } from "@/features/schedule/customer-booking-boundary";
import { buildSandboxCheckoutAvailability, type SandboxCheckoutAvailability, type SandboxCheckoutLaunchOutput } from "./sandbox-checkout-boundary";
export type CheckoutProviderMode = "FIXTURE" | "SANDBOX" | "LIVE";
interface CheckoutViewInput { quote: QuoteDTO; slot: SlotDTO; visit: VisitDTO; invoice: InvoiceDTO; paymentMode: CheckoutProviderMode; holdExpiresAt: string; heldSlot?: HeldSlotOutcome; sandboxCheckoutHandlerInjected?: boolean; sandboxCheckoutPending?: boolean; sandboxCheckout?: SandboxCheckoutLaunchOutput; now?: string }
export interface CheckoutView { quoteState: string; slotState: string; paymentState: string; visitState: string; holdLabel: string; depositLabel: string; balanceLabel: string; primaryAction: string; canShowReceipt: boolean; warning: string; checkoutAvailability: SandboxCheckoutAvailability; checkoutUrl?: string; providerSessionLabel?: string; }
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
export function buildCheckoutView({ quote, slot, visit, invoice, paymentMode, holdExpiresAt, heldSlot, sandboxCheckoutHandlerInjected = false, sandboxCheckoutPending = false, sandboxCheckout, now = new Date(0).toISOString() }: CheckoutViewInput): CheckoutView {
  const quoteAccepted = quote.status === "ACCEPTED";
  const availability = buildSandboxCheckoutAvailability({ quote, heldSlot, handlerInjected: sandboxCheckoutHandlerInjected, now, pending: sandboxCheckoutPending });
  const quoteState = quoteAccepted ? `Quote accepted · version ${quote.version}` : quote.status === "EXPIRED" ? `Quote expired · version ${quote.version}` : `Quote ${quote.status.toLowerCase().replaceAll("_", " ")} · version ${quote.version}`;
  const slotState = slot.availabilityFresh ? "Fresh slot on hold" : "Calendar stale · staff review required";
  const paymentState = sandboxCheckout ? "SANDBOX CHECKOUT LAUNCHED / PAYMENT PENDING" : "SANDBOX checkout · payment pending";
  const visitState = visit.status === "PAYMENT_REVIEW" ? "Payment review required" : "Awaiting verified payment before confirmation";
  const primaryAction = sandboxCheckout ? "Continue sandbox checkout" : availability.label;
  return { quoteState, slotState, paymentState, visitState, holdLabel: heldSlot ? `Hold ${heldSlot.holdId} expires ${heldSlot.expiresAt}` : `Hold expires ${holdExpiresAt}`, depositLabel: money(quote.depositMinor, quote.currency), balanceLabel: money(quote.balanceMinor, quote.currency), primaryAction, canShowReceipt: false, warning: "Current payment policy is SANDBOX/demo. Checkout launch does not mean paid, receipt verified, or visit confirmed; only a later verified payment flow may update InvoiceDTO/VisitDTO.", checkoutAvailability: availability, checkoutUrl: sandboxCheckout?.checkoutUrl, providerSessionLabel: sandboxCheckout ? `Sandbox session ${sandboxCheckout.providerSessionId}` : undefined };
}
