import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/contracts";
import type { CapacitySlot, SlotHold } from "../../src/domain/capacity";
import { scheduleVisitFromHoldWithRepository, type VisitRecord } from "../../src/server/core/visits";

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
const hold: SlotHold = {
  id: "hold_1",
  workspaceId: "ws_1",
  slotId: "slot_1",
  quoteId: "quote_1",
  expiresAt: "2026-10-04T06:15:00.000Z",
  status: "HELD",
};

function repo(holdFixture: SlotHold = hold) {
  const inserted: VisitRecord[] = [];
  const confirmedHolds: string[] = [];

  return {
    inserted,
    confirmedHolds,
    repository: {
      nextVisitId: () => "visit_1",
      findHoldById: async (workspaceId: string, holdId: string) => (
        workspaceId === holdFixture.workspaceId && holdId === holdFixture.id
          ? { ok: true as const, value: holdFixture }
          : { ok: false as const, code: "HOLD_NOT_FOUND", message: "Hold was not found in this workspace." }
      ),
      findSlotById: async (workspaceId: string, slotId: string) => (
        workspaceId === slot.workspaceId && slotId === slot.id
          ? { ok: true as const, value: slot }
          : { ok: false as const, code: "SLOT_NOT_FOUND", message: "Slot was not found in this workspace." }
      ),
      confirmHold: async (workspaceId: string, holdId: string) => {
        confirmedHolds.push(`${workspaceId}:${holdId}`);
        return { ok: true as const, value: true };
      },
      insertVisit: async (visit: VisitRecord) => {
        inserted.push(visit);
        return { ok: true as const, value: visit };
      },
    },
  };
}

describe("visit scheduling from held slots", () => {
  it("creates a scheduled visit from an active hold and confirms the hold", async () => {
    const fixture = repo();

    await expect(scheduleVisitFromHoldWithRepository(dispatcher, {
      workspaceId: "ws_1",
      requestId: "req_1",
      quoteId: "quote_1",
      holdId: "hold_1",
      timezone: "Europe/London",
    }, { idempotencyKey: "visit-1", now }, fixture.repository)).resolves.toMatchObject({
      ok: true,
      value: {
        id: "visit_1",
        requestId: "req_1",
        quoteId: "quote_1",
        slotId: "slot_1",
        holdId: "hold_1",
        crewId: "crew_1",
        status: "SCHEDULED",
        startsAt: "2026-10-05T09:00:00.000Z",
        endsAt: "2026-10-05T13:30:00.000Z",
        version: 1,
      },
    });
    expect(fixture.confirmedHolds).toEqual(["ws_1:hold_1"]);
    expect(fixture.inserted).toHaveLength(1);
  });

  it("rejects expired or wrong quote holds", async () => {
    await expect(scheduleVisitFromHoldWithRepository(dispatcher, {
      workspaceId: "ws_1",
      requestId: "req_1",
      quoteId: "quote_1",
      holdId: "hold_1",
      timezone: "Europe/London",
    }, { idempotencyKey: "visit-expired", now: "2026-10-04T06:16:00.000Z" }, repo().repository)).resolves.toEqual({
      ok: false,
      code: "HOLD_EXPIRED",
      message: "Hold expired before visit scheduling.",
    });

    await expect(scheduleVisitFromHoldWithRepository(dispatcher, {
      workspaceId: "ws_1",
      requestId: "req_1",
      quoteId: "quote_other",
      holdId: "hold_1",
      timezone: "Europe/London",
    }, { idempotencyKey: "visit-wrong-quote", now }, repo().repository)).resolves.toEqual({
      ok: false,
      code: "HOLD_QUOTE_MISMATCH",
      message: "Hold does not belong to this quote.",
    });
  });
});
