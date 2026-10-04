import type { ActorContext, CommandMeta, Result, SlotDTO } from "../../contracts";
import { findAvailableSlots, type CapacitySlot, type SlotHold } from "../../domain/capacity";
import type { QuoteSnapshot } from "../../domain/quote";
import { requireActiveStaffContext, requireRole, requireWorkspace } from "./auth";
import { holdSlotWithRepository, type CapacityRepository } from "./capacity";
import type { FindSlotsInput, ServiceDeskFacade } from "./facade";
import type { RequestRecord, RequestRepository } from "./requests";

export interface CapacityFacadeRepository extends CapacityRepository {
  listSlots(workspaceId: string, from: string, to: string, preferredCrewId?: string): Promise<Result<CapacitySlot[]>>;
  listActiveHoldsForWindow(workspaceId: string, from: string, to: string, now: string): Promise<Result<SlotHold[]>>;
}

export interface CapacityFacadeQuoteRepository {
  findById(quoteId: string): Promise<QuoteSnapshot | undefined>;
  findLatestByRequest(requestId: string): Promise<QuoteSnapshot | undefined>;
}

export interface CapacityFacadeDependencies {
  requestRepository: Pick<RequestRepository, "findById">;
  quoteRepository: CapacityFacadeQuoteRepository;
  capacityRepository: CapacityFacadeRepository;
  now: () => string;
}

function authorizeAvailabilityRead(ctx: ActorContext, request: Pick<RequestRecord, "workspaceId" | "visitorSessionId">): Result<true> {
  const workspace = requireWorkspace(ctx, request.workspaceId);
  if (workspace.ok === false) return workspace;

  if (ctx.role === "VISITOR") {
    if (ctx.visitorSessionId && request.visitorSessionId && ctx.visitorSessionId === request.visitorSessionId) {
      return { ok: true, value: true };
    }
    return { ok: false, code: "VISITOR_SCOPE_REQUIRED", message: "Visitor session cannot access slots for this request." };
  }

  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

function authorizeHoldByQuote(ctx: ActorContext, quote: Pick<QuoteSnapshot, "workspaceId">): Result<true> {
  const workspace = requireWorkspace(ctx, quote.workspaceId);
  if (workspace.ok === false) return workspace;

  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

function slotToDTO(slot: CapacitySlot, quote: Pick<QuoteSnapshot, "durationMinutes" | "bufferMinutes">): SlotDTO {
  return {
    id: slot.id,
    workspaceId: slot.workspaceId,
    crewId: slot.crewId,
    startAt: slot.startsAt,
    endAt: slot.endsAt,
    serviceMinutes: quote.durationMinutes,
    bufferMinutes: quote.bufferMinutes,
    availabilityFresh: true,
  };
}

export function createCapacityFacadeMethods(deps: CapacityFacadeDependencies): Pick<ServiceDeskFacade, "findSlots" | "holdSlot"> {
  return {
    async findSlots(ctx: ActorContext, input: FindSlotsInput): Promise<SlotDTO[]> {
      const request = await deps.requestRepository.findById(ctx.workspaceId, input.requestId);
      if (request.ok === false) return [];

      const authorized = authorizeAvailabilityRead(ctx, request.value);
      if (authorized.ok === false) return [];

      const quote = await deps.quoteRepository.findLatestByRequest(input.requestId);
      if (!quote || quote.workspaceId !== ctx.workspaceId) return [];

      const slots = await deps.capacityRepository.listSlots(ctx.workspaceId, input.from, input.to, input.preferredCrewId);
      if (slots.ok === false) return [];

      const holds = await deps.capacityRepository.listActiveHoldsForWindow(ctx.workspaceId, input.from, input.to, deps.now());
      if (holds.ok === false) return [];

      return findAvailableSlots({
        workspaceId: ctx.workspaceId,
        slots: slots.value,
        existingHolds: holds.value,
        durationMinutes: quote.durationMinutes,
        bufferMinutes: quote.bufferMinutes,
        now: deps.now(),
      }).map((slot) => slotToDTO(slot, quote));
    },

    async holdSlot(ctx: ActorContext, slotId: string, quoteId: string, meta: CommandMeta): Promise<Result<{ holdId: string; expiresAt: string }>> {
      const quote = await deps.quoteRepository.findById(quoteId);
      if (!quote) return { ok: false, code: "QUOTE_NOT_FOUND", message: "No quote exists for this identifier." };

      const authorized = authorizeHoldByQuote(ctx, quote);
      if (authorized.ok === false) return authorized;

      const hold = await holdSlotWithRepository(ctx, {
        slotId,
        quoteId,
        quoteWorkspaceId: quote.workspaceId,
        durationMinutes: quote.durationMinutes,
        bufferMinutes: quote.bufferMinutes,
      }, meta, deps.capacityRepository);
      if (hold.ok === false) return hold;

      return { ok: true, value: { holdId: hold.value.id, expiresAt: hold.value.expiresAt } };
    },
  };
}
