import type { ActorContext, CommandMeta, QuoteDTO, Result, SlotDTO } from "@/contracts";
import type { FindSlotsInput } from "@/server/core/facade";
import { productActionFailure, productActionSuccess, type ProductActionError, type ProductActionResult } from "@/features/operations/server-action-adapters";

export interface HeldSlotOutcome { slot: SlotDTO; holdId: string; expiresAt: string; quoteId: string; expectedQuoteVersion: number }
export interface CustomerBookingPort {
  findSlots(ctx: ActorContext, input: FindSlotsInput): Promise<SlotDTO[]>;
  holdSlot(ctx: ActorContext, slotId: string, quoteId: string, meta: CommandMeta): Promise<Result<{ holdId: string; expiresAt: string }>>;
}
export interface CustomerFindSlotsInput { ctx: ActorContext; quote: QuoteDTO; requestId: string; from: string; to: string; preferredCrewId?: string }
export interface CustomerHoldSlotInput { ctx: ActorContext; quote: QuoteDTO; slot: SlotDTO; idempotencyKey: string; now: string }
const failure = (error: { code: string; message: string }): ProductActionError => ({ code: error.code, message: error.message });
export function createCustomerBookingFactory(port: CustomerBookingPort) {
  return {
    async findSlots(input: CustomerFindSlotsInput): Promise<ProductActionResult<SlotDTO[]>> {
      const steps = ["findSlots"];
      if (input.quote.workspaceId !== input.ctx.workspaceId) return productActionFailure(failure({ code: "WORKSPACE_MISMATCH", message: "Quote workspace mismatch." }), steps, "findSlots");
      if (input.quote.status !== "ACCEPTED") return productActionFailure(failure({ code: "QUOTE_NOT_ACCEPTED", message: "Slots can be selected only after authoritative quote acceptance." }), steps, "findSlots");
      const slots = await port.findSlots(input.ctx, { requestId: input.requestId, from: input.from, to: input.to, preferredCrewId: input.preferredCrewId });
      const workspaceSlots = slots.filter((slot) => slot.workspaceId === input.ctx.workspaceId);
      if (workspaceSlots.length !== slots.length) return productActionFailure(failure({ code: "WORKSPACE_MISMATCH", message: "One or more slots belong to another workspace." }), steps, "findSlots");
      if (workspaceSlots.length === 0) return productActionFailure(failure({ code: "NO_SLOTS", message: "No authoritative slots are available for this quote." }), steps, "findSlots");
      return productActionSuccess(workspaceSlots, steps, "Slots loaded from exact findSlots facade call.");
    },
    async holdSlot(input: CustomerHoldSlotInput): Promise<ProductActionResult<HeldSlotOutcome>> {
      const steps = ["holdSlot"];
      if (input.quote.workspaceId !== input.ctx.workspaceId || input.slot.workspaceId !== input.ctx.workspaceId) return productActionFailure(failure({ code: "WORKSPACE_MISMATCH", message: "Quote or slot workspace mismatch." }), steps, "holdSlot");
      if (input.quote.status !== "ACCEPTED") return productActionFailure(failure({ code: "QUOTE_NOT_ACCEPTED", message: "A slot hold requires an accepted quote." }), steps, "holdSlot");
      if (!input.slot.availabilityFresh) return productActionFailure(failure({ code: "SLOT_STALE", message: "Selected slot availability is stale." }), steps, "holdSlot");
      const result = await port.holdSlot(input.ctx, input.slot.id, input.quote.id, { expectedVersion: input.quote.version, idempotencyKey: input.idempotencyKey, now: input.now });
      return result.ok ? productActionSuccess({ slot: input.slot, holdId: result.value.holdId, expiresAt: result.value.expiresAt, quoteId: input.quote.id, expectedQuoteVersion: input.quote.version }, steps, "Slot hold accepted with authoritative expiry.") : productActionFailure(failure(result), steps, "holdSlot");
    },
  };
}
