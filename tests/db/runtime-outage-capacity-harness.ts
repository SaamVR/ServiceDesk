import assert from "node:assert/strict";
import { createSlotHold, findAvailableSlots, type CapacitySlot, type SlotHold } from "../../src/domain/capacity";
import { holdSlotWithRepository } from "../../src/server/core/capacity";
import type { ActorContext, CommandMeta, Result } from "../../src/contracts";

const now = "2026-10-04T06:00:00.000Z";
const owner: ActorContext = { workspaceId: "ws_1", userId: "owner_1", role: "OWNER" };
const meta: CommandMeta = { idempotencyKey: "idem", now };
const validFutureSlot: CapacitySlot = {
  id: "slot_future",
  workspaceId: "ws_1",
  crewId: "crew_1",
  startsAt: "2026-10-05T09:00:00.000Z",
  endsAt: "2026-10-05T13:30:00.000Z",
  capacityMinutes: 270,
};

async function main() {
  assert.deepEqual(findAvailableSlots({ workspaceId: "ws_1", slots: [validFutureSlot], existingHolds: [], durationMinutes: 240, bufferMinutes: 30, now }).map((slot) => slot.id), ["slot_future"]);

  const activeHold: SlotHold = { id: "hold_active", workspaceId: "ws_1", slotId: "slot_future", quoteId: "quote_old", expiresAt: "2026-10-04T06:15:00.000Z", status: "HELD" };
  assert.deepEqual(findAvailableSlots({ workspaceId: "ws_1", slots: [validFutureSlot], existingHolds: [activeHold], durationMinutes: 240, bufferMinutes: 30, now }).map((slot) => slot.id), []);

  const expiredHold: SlotHold = { ...activeHold, expiresAt: "2026-10-04T05:59:59.000Z" };
  assert.deepEqual(findAvailableSlots({ workspaceId: "ws_1", slots: [validFutureSlot], existingHolds: [expiredHold], durationMinutes: 240, bufferMinutes: 30, now }).map((slot) => slot.id), ["slot_future"]);

  const pastSlot = { ...validFutureSlot, id: "slot_past", startsAt: "2026-10-04T04:00:00.000Z", endsAt: "2026-10-04T08:30:00.000Z" };
  assert.deepEqual(findAvailableSlots({ workspaceId: "ws_1", slots: [pastSlot], existingHolds: [], durationMinutes: 240, bufferMinutes: 30, now }), []);

  const startsNowSlot = { ...validFutureSlot, id: "slot_now", startsAt: now, endsAt: "2026-10-04T10:30:00.000Z" };
  assert.deepEqual(findAvailableSlots({ workspaceId: "ws_1", slots: [startsNowSlot], existingHolds: [], durationMinutes: 240, bufferMinutes: 30, now }), []);

  const invalidWindowSlot = { ...validFutureSlot, id: "slot_invalid", startsAt: "2026-10-05T13:30:00.000Z", endsAt: "2026-10-05T09:00:00.000Z" };
  assert.deepEqual(findAvailableSlots({ workspaceId: "ws_1", slots: [invalidWindowSlot], existingHolds: [], durationMinutes: 1, bufferMinutes: 0, now }), []);

  for (const holdMinutes of [0, -1, 1.5]) {
    const result = createSlotHold({ workspaceId: "ws_1", slotId: "slot_future", quoteId: "quote_1", now, holdMinutes, existingHolds: [], createId: () => "hold_bad" });
    assert.deepEqual(result, { ok: false, code: "HOLD_DURATION_INVALID", message: "Hold duration must be a positive integer number of minutes." });
  }

  let insertedCrossWorkspace = false;
  const crossWorkspaceRepo = {
    nextHoldId: () => "hold_cross",
    findSlotById: async (): Promise<Result<CapacitySlot>> => ({ ok: true, value: { ...validFutureSlot, workspaceId: "ws_2" } }),
    listActiveHoldsForSlot: async (): Promise<Result<SlotHold[]>> => ({ ok: true, value: [] }),
    insertHold: async (hold: SlotHold): Promise<Result<SlotHold>> => { insertedCrossWorkspace = true; return { ok: true, value: hold }; },
  };
  const crossWorkspace = await holdSlotWithRepository(owner, { slotId: "slot_future", quoteId: "quote_1", quoteWorkspaceId: "ws_1", durationMinutes: 240, bufferMinutes: 30 }, meta, crossWorkspaceRepo);
  assert.deepEqual(crossWorkspace, { ok: false, code: "SLOT_WORKSPACE_MISMATCH", message: "Slot does not belong to this workspace." });
  assert.equal(insertedCrossWorkspace, false);

  const insertedHolds: SlotHold[] = [];
  const validRepo = {
    nextHoldId: () => "hold_1",
    findSlotById: async (): Promise<Result<CapacitySlot>> => ({ ok: true, value: validFutureSlot }),
    listActiveHoldsForSlot: async (): Promise<Result<SlotHold[]>> => ({ ok: true, value: [] }),
    insertHold: async (hold: SlotHold): Promise<Result<SlotHold>> => { insertedHolds.push(hold); return { ok: true, value: hold }; },
  };
  const held = await holdSlotWithRepository(owner, { slotId: "slot_future", quoteId: "quote_1", quoteWorkspaceId: "ws_1", durationMinutes: 240, bufferMinutes: 30 }, meta, validRepo);
  assert.equal(held.ok, true);
  if (held.ok) {
    assert.equal(held.value.expiresAt, "2026-10-04T06:15:00.000Z");
  }
  assert.equal(insertedHolds.length, 1);

  console.log("runtime-outage capacity harness PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
