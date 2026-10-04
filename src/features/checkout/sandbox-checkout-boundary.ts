import type { ActorContext, QuoteDTO, Result } from "@/contracts";
import { productActionFailure, productActionSuccess, type ProductActionError, type ProductActionResult } from "@/features/operations/server-action-adapters";
import type { HeldSlotOutcome } from "@/features/schedule/customer-booking-boundary";

export interface SandboxCheckoutLaunchOutput {
  checkoutUrl: string;
  providerSessionId: string;
  amountMinor: number;
  currency: string;
  mode: "SANDBOX";
  redactedEvidenceReference?: string;
  state: "SANDBOX_CHECKOUT_LAUNCHED" | "PAYMENT_PENDING";
}
export interface SafeSandboxCheckoutCommandInput { ctx: ActorContext; quoteId: string; holdId: string; mode: "SANDBOX"; idempotencyKey: string; now: string }
export interface SafeSandboxCheckoutPort { launchSandboxCheckout(input: SafeSandboxCheckoutCommandInput): Promise<Result<SandboxCheckoutLaunchOutput>> }
export interface SandboxCheckoutLaunchInput { ctx: ActorContext; quote: QuoteDTO; heldSlot: HeldSlotOutcome; idempotencyKey: string; now: string }
export interface SandboxCheckoutAvailability { enabled: boolean; label: string; disabledReason?: string; pending?: boolean }
const failure = (error: { code: string; message: string }): ProductActionError => ({ code: error.code, message: error.message });
export function buildSandboxCheckoutAvailability(input: { quote: QuoteDTO; heldSlot?: HeldSlotOutcome; handlerInjected: boolean; now: string; pending?: boolean }): SandboxCheckoutAvailability {
  if (input.pending) return { enabled: false, pending: true, label: "Sandbox checkout launching", disabledReason: "Checkout launch is pending." };
  if (!input.handlerInjected) return { enabled: false, label: "Sandbox checkout unavailable", disabledReason: "No safe sandbox checkout handler is injected." };
  if (input.quote.status !== "ACCEPTED") return { enabled: false, label: "Accept quote first", disabledReason: "Checkout can launch only after authoritative QuoteDTO status is ACCEPTED." };
  if (!input.heldSlot) return { enabled: false, label: "Hold a slot first", disabledReason: "Checkout requires an authoritative holdId and expiry." };
  if (Date.parse(input.heldSlot.expiresAt) <= Date.parse(input.now)) return { enabled: false, label: "Hold expired", disabledReason: "Refresh availability and hold a new slot before checkout." };
  return { enabled: true, label: "Launch sandbox checkout" };
}
export function createSandboxCheckoutLaunchFactory(port: SafeSandboxCheckoutPort) {
  return async function launchSandboxCheckout(input: SandboxCheckoutLaunchInput): Promise<ProductActionResult<SandboxCheckoutLaunchOutput>> {
    const steps = ["launchSandboxCheckout"];
    const availability = buildSandboxCheckoutAvailability({ quote: input.quote, heldSlot: input.heldSlot, handlerInjected: true, now: input.now });
    if (!availability.enabled) return productActionFailure(failure({ code: availability.label === "Hold expired" ? "HOLD_EXPIRED" : "CHECKOUT_CONFIGURATION_BLOCKED", message: availability.disabledReason ?? "Sandbox checkout unavailable." }), steps, "launchSandboxCheckout");
    const result = await port.launchSandboxCheckout({ ctx: input.ctx, quoteId: input.quote.id, holdId: input.heldSlot.holdId, mode: "SANDBOX", idempotencyKey: input.idempotencyKey, now: input.now });
    if (!result.ok) return productActionFailure(failure({ code: result.code || "CHECKOUT_SANDBOX_FAILURE", message: result.message }), steps, "launchSandboxCheckout");
    if (result.value.mode !== "SANDBOX") return productActionFailure(failure({ code: "CHECKOUT_CONFIGURATION_BLOCKED", message: "Product accepts only SANDBOX checkout launch output in V1." }), steps, "launchSandboxCheckout");
    return productActionSuccess({ ...result.value, state: "PAYMENT_PENDING" }, steps, "SANDBOX CHECKOUT LAUNCHED / PAYMENT PENDING. No paid state is created.");
  };
}
