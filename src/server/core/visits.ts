import type { ActorContext, CommandMeta, Result } from "../../contracts";
import { hasActiveHold, type CapacitySlot, type SlotHold } from "../../domain/capacity";
import { requireActiveStaffContext, requireRole, requireWorkspace } from "./auth";

export type VisitStatus = "SCHEDULED" | "ASSIGNED" | "EN_ROUTE" | "IN_PROGRESS" | "NEEDS_REVIEW" | "COMPLETED" | "CANCELLED";

export interface VisitRecord {
  id: string;
  workspaceId: string;
  requestId: string;
  quoteId: string;
  slotId: string;
  holdId: string;
  crewId: string;
  status: VisitStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleVisitFromHoldInput {
  workspaceId: string;
  requestId: string;
  quoteId: string;
  holdId: string;
  timezone: string;
}

export interface VisitRepository {
  nextVisitId(): string;
  findHoldById(workspaceId: string, holdId: string): Promise<Result<SlotHold>>;
  findSlotById(workspaceId: string, slotId: string): Promise<Result<CapacitySlot>>;
  confirmHold(workspaceId: string, holdId: string, meta: CommandMeta): Promise<Result<true>>;
  insertVisit(visit: VisitRecord, meta: CommandMeta): Promise<Result<VisitRecord>>;
}

function authorizeVisitScheduling(ctx: ActorContext, workspaceId: string): Result<true> {
  const workspace = requireWorkspace(ctx, workspaceId);
  if (workspace.ok === false) return workspace;

  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

export async function scheduleVisitFromHoldWithRepository(
  ctx: ActorContext,
  input: ScheduleVisitFromHoldInput,
  meta: CommandMeta,
  repository: VisitRepository,
): Promise<Result<VisitRecord>> {
  const authorized = authorizeVisitScheduling(ctx, input.workspaceId);
  if (authorized.ok === false) return authorized;

  const hold = await repository.findHoldById(ctx.workspaceId, input.holdId);
  if (hold.ok === false) return hold;

  if (hold.value.quoteId !== input.quoteId) {
    return { ok: false, code: "HOLD_QUOTE_MISMATCH", message: "Hold does not belong to this quote." };
  }

  if (!hasActiveHold(hold.value, meta.now)) {
    return { ok: false, code: "HOLD_EXPIRED", message: "Hold expired before visit scheduling." };
  }

  const slot = await repository.findSlotById(ctx.workspaceId, hold.value.slotId);
  if (slot.ok === false) return slot;

  const confirmed = await repository.confirmHold(ctx.workspaceId, hold.value.id, meta);
  if (confirmed.ok === false) return confirmed;

  const visit: VisitRecord = {
    id: repository.nextVisitId(),
    workspaceId: ctx.workspaceId,
    requestId: input.requestId,
    quoteId: input.quoteId,
    slotId: slot.value.id,
    holdId: hold.value.id,
    crewId: slot.value.crewId,
    status: "SCHEDULED",
    startsAt: slot.value.startsAt,
    endsAt: slot.value.endsAt,
    timezone: input.timezone,
    version: 1,
    createdAt: meta.now,
    updatedAt: meta.now,
  };

  return repository.insertVisit(visit, meta);
}
