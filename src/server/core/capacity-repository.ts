import type { CommandMeta, Result } from "../../contracts";
import type { CapacitySlot, SlotHold, SlotHoldStatus } from "../../domain/capacity";
import type { CapacityFacadeRepository } from "./capacity-facade";

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

export interface CapacityTableError {
  message: string;
  code?: string;
}

export interface CapacityTableResult<T> {
  data: T | null;
  error: CapacityTableError | null;
}

export interface CapacityTableGateway {
  nextHoldId(): string;
  findSlotById(workspaceId: string, slotId: string): Promise<CapacityTableResult<CapacitySlotRow | null>>;
  listSlots(workspaceId: string, from: string, to: string, preferredCrewId?: string): Promise<CapacityTableResult<CapacitySlotRow[]>>;
  listActiveHoldsForSlot(workspaceId: string, slotId: string, now: string): Promise<CapacityTableResult<SlotHoldRow[]>>;
  listActiveHoldsForWindow(workspaceId: string, from: string, to: string, now: string): Promise<CapacityTableResult<SlotHoldRow[]>>;
  insertHold(row: SlotHoldRow, meta: CommandMeta): Promise<CapacityTableResult<SlotHoldRow>>;
}

function repositoryError(error: CapacityTableError): Result<never> {
  return { ok: false, code: "CAPACITY_REPOSITORY_ERROR", message: error.message };
}

function notFound(): Result<never> {
  return { ok: false, code: "SLOT_NOT_FOUND", message: "Capacity slot was not found in this workspace." };
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

export function mapSlotHoldRecordToRow(hold: SlotHold): SlotHoldRow {
  return {
    id: hold.id,
    workspace_id: hold.workspaceId,
    slot_id: hold.slotId,
    quote_id: hold.quoteId,
    expires_at: hold.expiresAt,
    status: hold.status,
  };
}

export function createPostgresCapacityRepository(gateway: CapacityTableGateway): CapacityFacadeRepository {
  return {
    nextHoldId: () => gateway.nextHoldId(),

    async findSlotById(workspaceId, slotId) {
      const result = await gateway.findSlotById(workspaceId, slotId);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return notFound();
      return { ok: true, value: mapCapacitySlotRowToRecord(result.data) };
    },

    async listSlots(workspaceId, from, to, preferredCrewId) {
      const result = await gateway.listSlots(workspaceId, from, to, preferredCrewId);
      if (result.error) return repositoryError(result.error);
      return { ok: true, value: (result.data ?? []).map(mapCapacitySlotRowToRecord) };
    },

    async listActiveHoldsForSlot(workspaceId, slotId, now) {
      const result = await gateway.listActiveHoldsForSlot(workspaceId, slotId, now);
      if (result.error) return repositoryError(result.error);
      return { ok: true, value: (result.data ?? []).map(mapSlotHoldRowToRecord) };
    },

    async listActiveHoldsForWindow(workspaceId, from, to, now) {
      const result = await gateway.listActiveHoldsForWindow(workspaceId, from, to, now);
      if (result.error) return repositoryError(result.error);
      return { ok: true, value: (result.data ?? []).map(mapSlotHoldRowToRecord) };
    },

    async insertHold(hold, meta) {
      const result = await gateway.insertHold(mapSlotHoldRecordToRow(hold), meta);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return { ok: false, code: "HOLD_NOT_CREATED", message: "Slot hold was not created." };
      return { ok: true, value: mapSlotHoldRowToRecord(result.data) };
    },
  };
}
