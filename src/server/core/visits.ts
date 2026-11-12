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
  /** Required proof reference; the atomic database port independently verifies it. */
  verifiedPaymentApplicationId?: string;
}

export interface AtomicScheduledVisitReceipt {
  visit: VisitRecord;
  confirmedHold: SlotHold;
}
export interface VisitRepository {
  nextVisitId(): string;
  findHoldById(workspaceId: string, holdId: string): Promise<Result<SlotHold>>;
  findSlotById(workspaceId: string, slotId: string): Promise<Result<CapacitySlot>>;
  /**
   * MUST be one database transaction: lock hold/slot/quote, verify an APPLIED
   * DEPOSIT for this exact tenant/hold/quote, insert one visit, confirm hold,
   * and read back the committed rows. No confirm-then-insert fallback.
   * The existing verified-payment RPC is the preferred production path.
   */
  commitScheduledVisit?: (
    visit: VisitRecord, verifiedPaymentApplicationId: string, meta: CommandMeta,
  ) => Promise<Result<AtomicScheduledVisitReceipt>>;
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

  if (hold.value.workspaceId !== ctx.workspaceId ||
      slot.value.workspaceId !== ctx.workspaceId ||
      slot.value.id !== hold.value.slotId ||
      !slot.value.crewId ||
      !Number.isFinite(Date.parse(slot.value.startsAt)) ||
      !Number.isFinite(Date.parse(slot.value.endsAt)) ||
      Date.parse(slot.value.endsAt) <= Date.parse(slot.value.startsAt)) {
    return { ok: false, code: "VISIT_SOURCE_INVALID", message: "Hold or slot source was not verified." };
  }
  if (!input.verifiedPaymentApplicationId || !input.verifiedPaymentApplicationId.trim() ||
      input.verifiedPaymentApplicationId.length > 128) {
    return { ok: false, code: "VERIFIED_DEPOSIT_REQUIRED", message: "An applied deposit must be verified in the database." };
  }
  if (!repository.commitScheduledVisit) {
    return { ok: false, code: "ATOMIC_VISIT_UNAVAILABLE", message: "Atomic visit persistence is not configured." };
  }

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

  // Never make two independent writes here. Failure or an ambiguous response
  // is NOT evidence of rollback; callers must not retry blindly.
  const committed = await repository.commitScheduledVisit(visit, input.verifiedPaymentApplicationId, meta);
  if (committed.ok === false) return committed;
  const saved = committed.value.visit;
  const confirmed = committed.value.confirmedHold;
  if (confirmed.status !== "CONFIRMED" ||
      confirmed.workspaceId !== ctx.workspaceId ||
      confirmed.id !== input.holdId ||
      confirmed.quoteId !== input.quoteId ||
      confirmed.slotId !== slot.value.id ||
      saved.workspaceId !== visit.workspaceId ||
      saved.id !== visit.id ||
      saved.requestId !== visit.requestId ||
      saved.quoteId !== visit.quoteId ||
      saved.holdId !== visit.holdId ||
      saved.slotId !== visit.slotId ||
      saved.crewId !== visit.crewId ||
      saved.status !== "SCHEDULED" ||
      saved.version !== 1 ||
      saved.timezone !== visit.timezone ||
      saved.startsAt !== visit.startsAt ||
      saved.endsAt !== visit.endsAt) {
    return { ok: false, code: "ATOMIC_VISIT_READBACK_INVALID",
      message: "Atomic visit confirmation could not be independently verified." };
  }
  return { ok: true, value: saved };
}
