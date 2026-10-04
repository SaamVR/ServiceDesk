import type { ActorContext, CommandMeta, Result } from "../../contracts";
import { createSlotHold, findAvailableSlots, type CapacitySlot, type SlotHold } from "../../domain/capacity";
import { requireActiveStaffContext, requireRole, requireWorkspace } from "./auth";

export interface HoldSlotCommandInput {
  slotId: string;
  quoteId: string;
  quoteWorkspaceId: string;
  durationMinutes: number;
  bufferMinutes: number;
}

export interface CapacityRepository {
  nextHoldId(): string;
  findSlotById(workspaceId: string, slotId: string): Promise<Result<CapacitySlot>>;
  listActiveHoldsForSlot(workspaceId: string, slotId: string, now: string): Promise<Result<SlotHold[]>>;
  insertHold(hold: SlotHold, meta: CommandMeta): Promise<Result<SlotHold>>;
}

function authorizeHold(ctx: ActorContext, workspaceId: string): Result<true> {
  const workspace = requireWorkspace(ctx, workspaceId);
  if (workspace.ok === false) return workspace;

  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

export async function holdSlotWithRepository(
  ctx: ActorContext,
  input: HoldSlotCommandInput,
  meta: CommandMeta,
  repository: CapacityRepository,
): Promise<Result<SlotHold>> {
  const authorized = authorizeHold(ctx, input.quoteWorkspaceId);
  if (authorized.ok === false) return authorized;

  const slot = await repository.findSlotById(ctx.workspaceId, input.slotId);
  if (slot.ok === false) return slot;
  if (slot.value.workspaceId !== ctx.workspaceId) {
    return { ok: false, code: "SLOT_WORKSPACE_MISMATCH", message: "Slot does not belong to this workspace." };
  }

  const available = findAvailableSlots({
    workspaceId: ctx.workspaceId,
    slots: [slot.value],
    existingHolds: [],
    durationMinutes: input.durationMinutes,
    bufferMinutes: input.bufferMinutes,
    now: meta.now,
  });
  if (available.length === 0) {
    return { ok: false, code: "SLOT_CAPACITY_EXCEEDED", message: "Slot cannot fit this quote duration and buffer." };
  }

  const holds = await repository.listActiveHoldsForSlot(ctx.workspaceId, input.slotId, meta.now);
  if (holds.ok === false) return holds;

  const hold = createSlotHold({
    workspaceId: ctx.workspaceId,
    slotId: input.slotId,
    quoteId: input.quoteId,
    now: meta.now,
    holdMinutes: 15,
    existingHolds: holds.value,
    createId: () => repository.nextHoldId(),
  });
  if (hold.ok === false) return hold;

  return repository.insertHold(hold.value, meta);
}
