import type { CommandMeta, Result } from "../../contracts";
import type { CapacitySlot, SlotHold, SlotHoldStatus } from "../../domain/capacity";
import type { AtomicScheduledVisitReceipt, VisitRecord, VisitRepository, VisitStatus } from "./visits";

export interface CapacitySlotRow {
  id: string;
  workspace_id: string;
  crew_id: string;
  starts_at: string;
  ends_at: string;
  capacity_minutes: number;
}

export interface SlotHoldRow {
  id: string;
  workspace_id: string;
  slot_id: string;
  quote_id: string;
  expires_at: string;
  status: SlotHoldStatus;
}

export interface VisitRow {
  id: string;
  workspace_id: string;
  request_id: string;
  quote_id: string;
  slot_id: string;
  hold_id: string;
  crew_id: string;
  status: VisitStatus;
  starts_at: string;
  ends_at: string;
  timezone: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface VisitTableError {
  message: string;
  code?: string;
}

export interface VisitTableResult<T> {
  data: T | null;
  error: VisitTableError | null;
}

export interface VisitTableGateway {
  nextVisitId(): string;
  findHoldById(workspaceId: string, holdId: string): Promise<VisitTableResult<SlotHoldRow | null>>;
  findSlotById(workspaceId: string, slotId: string): Promise<VisitTableResult<CapacitySlotRow | null>>;
  /** Legacy two-write methods are retained for old gateways but NEVER used
   * by the scheduling adapter. A gateway must supply an atomic operation. */
  confirmHold?(workspaceId: string, holdId: string, meta: CommandMeta): Promise<VisitTableResult<null>>;
  insertVisit?(row: VisitRow, meta: CommandMeta): Promise<VisitTableResult<VisitRow>>;
  /** Implement with ONE trusted database transaction and verified payment. */
  commitScheduledVisit?(row: VisitRow, verifiedPaymentApplicationId: string, meta: CommandMeta):
    Promise<VisitTableResult<{ visit: VisitRow; hold: SlotHoldRow }>>;
}

function repositoryError(error: VisitTableError): Result<never> {
  return { ok: false, code: "VISIT_REPOSITORY_ERROR", message: error.message };
}

function notFound(code: "HOLD_NOT_FOUND" | "SLOT_NOT_FOUND" | "VISIT_NOT_CREATED", message: string): Result<never> {
  return { ok: false, code, message };
}

export function mapCapacitySlotRowToRecord(row: CapacitySlotRow): CapacitySlot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    crewId: row.crew_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacityMinutes: row.capacity_minutes,
  };
}

export function mapSlotHoldRowToRecord(row: SlotHoldRow): SlotHold {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    slotId: row.slot_id,
    quoteId: row.quote_id,
    expiresAt: row.expires_at,
    status: row.status,
  };
}

export function mapVisitRecordToRow(visit: VisitRecord): VisitRow {
  return {
    id: visit.id,
    workspace_id: visit.workspaceId,
    request_id: visit.requestId,
    quote_id: visit.quoteId,
    slot_id: visit.slotId,
    hold_id: visit.holdId,
    crew_id: visit.crewId,
    status: visit.status,
    starts_at: visit.startsAt,
    ends_at: visit.endsAt,
    timezone: visit.timezone,
    version: visit.version,
    created_at: visit.createdAt,
    updated_at: visit.updatedAt,
  };
}

export function mapVisitRowToRecord(row: VisitRow): VisitRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    requestId: row.request_id,
    quoteId: row.quote_id,
    slotId: row.slot_id,
    holdId: row.hold_id,
    crewId: row.crew_id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPostgresVisitRepository(gateway: VisitTableGateway): VisitRepository {
  return {
    nextVisitId: () => gateway.nextVisitId(),

    async findHoldById(workspaceId, holdId) {
      const result = await gateway.findHoldById(workspaceId, holdId);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return notFound("HOLD_NOT_FOUND", "Slot hold was not found in this workspace.");
      return { ok: true, value: mapSlotHoldRowToRecord(result.data) };
    },

    async findSlotById(workspaceId, slotId) {
      const result = await gateway.findSlotById(workspaceId, slotId);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return notFound("SLOT_NOT_FOUND", "Capacity slot was not found in this workspace.");
      return { ok: true, value: mapCapacitySlotRowToRecord(result.data) };
    },

    async commitScheduledVisit(visit, verifiedPaymentApplicationId, meta): Promise<Result<AtomicScheduledVisitReceipt>> {
      if (!gateway.commitScheduledVisit) return {
        ok: false, code: "ATOMIC_VISIT_UNAVAILABLE",
        message: "A trusted transaction-backed visit gateway is required.",
      };
      // Never replace this port with separate confirmHold / insertVisit calls.
      // In particular, an RPC acknowledgement alone is not a visit receipt.
      const result = await gateway.commitScheduledVisit(
        mapVisitRecordToRow(visit), verifiedPaymentApplicationId, meta,
      );
      if (result.error) return repositoryError(result.error);
      if (!result.data?.visit || !result.data.hold) return {
        ok: false, code: "ATOMIC_VISIT_READBACK_INVALID",
        message: "Atomic visit transaction returned no confirmed rows.",
      };
      const saved = mapVisitRowToRecord(result.data.visit);
      const confirmed = mapSlotHoldRowToRecord(result.data.hold);
      if (confirmed.status !== "CONFIRMED" ||
          confirmed.workspaceId !== visit.workspaceId ||
          confirmed.id !== visit.holdId ||
          confirmed.quoteId !== visit.quoteId ||
          confirmed.slotId !== visit.slotId ||
          saved.id !== visit.id ||
          saved.workspaceId !== visit.workspaceId ||
          saved.requestId !== visit.requestId ||
          saved.quoteId !== visit.quoteId ||
          saved.holdId !== visit.holdId ||
          saved.slotId !== visit.slotId ||
          saved.crewId !== visit.crewId ||
          saved.status !== "SCHEDULED" ||
          saved.startsAt !== visit.startsAt ||
          saved.endsAt !== visit.endsAt ||
          saved.version !== visit.version ||
          saved.timezone !== visit.timezone) return {
        ok: false, code: "ATOMIC_VISIT_READBACK_INVALID",
        message: "Atomic visit receipt did not match the intended hold or slot.",
      };
      return { ok: true, value: { visit: saved, confirmedHold: confirmed } };
    },
  };
}
