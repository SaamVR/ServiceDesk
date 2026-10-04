import { describe, expect, it } from "vitest";
import type { CapacitySlot, SlotHold } from "../../src/domain/capacity";
import {
  createPostgresCapacityRepository,
  mapCapacitySlotRowToRecord,
  mapSlotHoldRecordToRow,
  mapSlotHoldRowToRecord,
} from "../../src/server/core/capacity-repository";

const slot: CapacitySlot = {
  id: "slot_1",
  workspaceId: "ws_1",
  crewId: "crew_1",
  startsAt: "2026-10-05T09:00:00.000Z",
  endsAt: "2026-10-05T13:30:00.000Z",
  capacityMinutes: 270,
};

const hold: SlotHold = {
  id: "hold_1",
  workspaceId: "ws_1",
  slotId: "slot_1",
  quoteId: "quote_1",
  expiresAt: "2026-10-04T06:15:00.000Z",
  status: "HELD",
};

describe("capacity persistence adapter", () => {
  it("maps capacity slots and holds to persistence rows", () => {
    const slotRow = {
      id: "slot_1",
      workspace_id: "ws_1",
      crew_id: "crew_1",
      starts_at: "2026-10-05T09:00:00.000Z",
      ends_at: "2026-10-05T13:30:00.000Z",
      capacity_minutes: 270,
    };

    expect(mapCapacitySlotRowToRecord(slotRow)).toEqual(slot);
    expect(mapSlotHoldRecordToRow(hold)).toEqual({
      id: "hold_1",
      workspace_id: "ws_1",
      slot_id: "slot_1",
      quote_id: "quote_1",
      expires_at: "2026-10-04T06:15:00.000Z",
      status: "HELD",
    });
    expect(mapSlotHoldRowToRecord(mapSlotHoldRecordToRow(hold))).toEqual(hold);
  });

  it("scopes slot, hold, and window queries through a table gateway", async () => {
    const calls: string[] = [];
    const repo = createPostgresCapacityRepository({
      nextHoldId: () => "hold_2",
      findSlotById: async (workspaceId, slotId) => {
        calls.push(`findSlot:${workspaceId}:${slotId}`);
        return { data: {
          id: slot.id,
          workspace_id: slot.workspaceId,
          crew_id: slot.crewId,
          starts_at: slot.startsAt,
          ends_at: slot.endsAt,
          capacity_minutes: slot.capacityMinutes,
        }, error: null };
      },
      listSlots: async (workspaceId, from, to, preferredCrewId) => {
        calls.push(`listSlots:${workspaceId}:${from}:${to}:${preferredCrewId ?? "any"}`);
        return { data: [{
          id: slot.id,
          workspace_id: slot.workspaceId,
          crew_id: slot.crewId,
          starts_at: slot.startsAt,
          ends_at: slot.endsAt,
          capacity_minutes: slot.capacityMinutes,
        }], error: null };
      },
      listActiveHoldsForSlot: async (workspaceId, slotId, now) => {
        calls.push(`listHoldsForSlot:${workspaceId}:${slotId}:${now}`);
        return { data: [mapSlotHoldRecordToRow(hold)], error: null };
      },
      listActiveHoldsForWindow: async (workspaceId, from, to, now) => {
        calls.push(`listHoldsForWindow:${workspaceId}:${from}:${to}:${now}`);
        return { data: [mapSlotHoldRecordToRow(hold)], error: null };
      },
      insertHold: async (row) => {
        calls.push(`insertHold:${row.workspace_id}:${row.id}`);
        return { data: row, error: null };
      },
    });

    await expect(repo.findSlotById("ws_1", "slot_1")).resolves.toEqual({ ok: true, value: slot });
    await expect(repo.listSlots("ws_1", "from", "to", "crew_1")).resolves.toEqual({ ok: true, value: [slot] });
    await expect(repo.listActiveHoldsForSlot("ws_1", "slot_1", "now")).resolves.toEqual({ ok: true, value: [hold] });
    await expect(repo.listActiveHoldsForWindow("ws_1", "from", "to", "now")).resolves.toEqual({ ok: true, value: [hold] });
    await expect(repo.insertHold(hold, { idempotencyKey: "idem", now: "now" })).resolves.toEqual({ ok: true, value: hold });
    expect(repo.nextHoldId()).toBe("hold_2");
    expect(calls).toEqual([
      "findSlot:ws_1:slot_1",
      "listSlots:ws_1:from:to:crew_1",
      "listHoldsForSlot:ws_1:slot_1:now",
      "listHoldsForWindow:ws_1:from:to:now",
      "insertHold:ws_1:hold_1",
    ]);
  });
});
