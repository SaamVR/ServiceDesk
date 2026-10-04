import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/contracts";
import type { CapacitySlot, SlotHold } from "../../src/domain/capacity";
import { holdSlotWithRepository } from "../../src/server/core/capacity";

const dispatcher: ActorContext = { workspaceId: "ws_1", userId: "dispatcher_1", role: "DISPATCHER" };
const now = "2026-10-04T06:00:00.000Z";
const slot: CapacitySlot = {
  id: "slot_1",
  workspaceId: "ws_1",
  crewId: "crew_1",
  startsAt: "2026-10-05T09:00:00.000Z",
  endsAt: "2026-10-05T13:30:00.000Z",
  capacityMinutes: 270,
};

function repo(existingHolds: SlotHold[] = []) {
  const inserted: SlotHold[] = [];
  return {
    inserted,
    repository: {
      nextHoldId: () => "hold_new",
      findSlotById: async (workspaceId: string, slotId: string) => (
        workspaceId === slot.workspaceId && slotId === slot.id
          ? { ok: true as const, value: slot }
          : { ok: false as const, code: "SLOT_NOT_FOUND", message: "Slot was not found in this workspace." }
      ),
      listActiveHoldsForSlot: async () => ({ ok: true as const, value: existingHolds }),
      insertHold: async (hold: SlotHold) => {
        inserted.push(hold);
        return { ok: true as const, value: hold };
      },
    },
  };
}

describe("capacity hold repository command", () => {
  it("creates a hold only when the slot can fit quote duration plus buffer", async () => {
    const fixture = repo();

    await expect(holdSlotWithRepository(dispatcher, {
      slotId: "slot_1",
      quoteId: "quote_1",
      quoteWorkspaceId: "ws_1",
      durationMinutes: 240,
      bufferMinutes: 30,
    }, { idempotencyKey: "hold-1", now }, fixture.repository)).resolves.toMatchObject({
      ok: true,
      value: { id: "hold_new", slotId: "slot_1", quoteId: "quote_1", expiresAt: "2026-10-04T06:15:00.000Z" },
    });
    expect(fixture.inserted).toHaveLength(1);
  });

  it("rejects cross-workspace and active-held slot attempts", async () => {
    const held: SlotHold = {
      id: "hold_existing",
      workspaceId: "ws_1",
      slotId: "slot_1",
      quoteId: "quote_existing",
      expiresAt: "2026-10-04T06:10:00.000Z",
      status: "HELD",
    };
    const fixture = repo([held]);

    await expect(holdSlotWithRepository({ workspaceId: "ws_2", userId: "dispatcher_2", role: "DISPATCHER" }, {
      slotId: "slot_1",
      quoteId: "quote_1",
      quoteWorkspaceId: "ws_1",
      durationMinutes: 240,
      bufferMinutes: 30,
    }, { idempotencyKey: "hold-cross", now }, fixture.repository)).resolves.toEqual({
      ok: false,
      code: "WORKSPACE_MISMATCH",
      message: "Actor is not scoped to this workspace.",
    });

    await expect(holdSlotWithRepository(dispatcher, {
      slotId: "slot_1",
      quoteId: "quote_1",
      quoteWorkspaceId: "ws_1",
      durationMinutes: 240,
      bufferMinutes: 30,
    }, { idempotencyKey: "hold-conflict", now }, fixture.repository)).resolves.toEqual({
      ok: false,
      code: "SLOT_ALREADY_HELD",
      message: "Slot already has an active hold.",
    });
  });
});
