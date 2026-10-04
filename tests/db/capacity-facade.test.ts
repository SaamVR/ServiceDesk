import { describe, expect, it } from "vitest";
import type { CapacitySlot, SlotHold } from "../../src/domain/capacity";
import type { QuoteSnapshot } from "../../src/domain/quote";
import { holdSlotWithRepository } from "../../src/server/core/capacity";
import type { RequestRecord } from "../../src/server/core/requests";
import { createCapacityFacadeMethods } from "../../src/server/core/capacity-facade";

const now = "2026-10-04T06:00:00.000Z";
const owner = { workspaceId: "ws_1", userId: "owner_1", role: "OWNER" as const };

const request: RequestRecord = {
  id: "req_1",
  workspaceId: "ws_1",
  customerId: "cust_1",
  propertyId: "prop_1",
  serviceCode: "MOVE_OUT",
  status: "READY",
  bedrooms: 3,
  bathrooms: 2,
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const quote: QuoteSnapshot = {
  id: "quote_1",
  workspaceId: "ws_1",
  requestId: "req_1",
  version: 1,
  status: "ACCEPTED",
  currency: "USD",
  serviceCode: "MOVE_OUT",
  subtotalMinor: 34_000,
  taxMinor: 0,
  totalMinor: 34_000,
  depositMinor: 8_500,
  balanceMinor: 25_500,
  durationMinutes: 240,
  bufferMinutes: 30,
  rateVersion: "synthetic-cleaning-v1",
  validUntil: "2026-10-06T06:00:00.000Z",
  lineItems: [],
};

describe("capacity facade methods", () => {
  it("returns facade SlotDTOs using the latest quote duration and buffer", async () => {
    const methods = createCapacityFacadeMethods({
      now: () => now,
      requestRepository: { findById: async () => ({ ok: true, value: request }) },
      quoteRepository: {
        findById: async () => quote,
        findLatestByRequest: async () => quote,
      },
      capacityRepository: {
        nextHoldId: () => "hold_1",
        findSlotById: async () => ({ ok: false, code: "UNUSED", message: "unused" }),
        listActiveHoldsForSlot: async () => ({ ok: true, value: [] }),
        insertHold: async (hold) => ({ ok: true, value: hold }),
        listSlots: async () => ({ ok: true, value: [{
          id: "slot_1",
          workspaceId: "ws_1",
          crewId: "crew_1",
          startsAt: "2026-10-05T09:00:00.000Z",
          endsAt: "2026-10-05T13:30:00.000Z",
          capacityMinutes: 270,
        }] }),
        listActiveHoldsForWindow: async () => ({ ok: true, value: [] }),
      },
    });

    await expect(methods.findSlots(owner, {
      requestId: "req_1",
      from: "2026-10-05T00:00:00.000Z",
      to: "2026-10-06T00:00:00.000Z",
    })).resolves.toEqual([{
      id: "slot_1",
      workspaceId: "ws_1",
      crewId: "crew_1",
      startAt: "2026-10-05T09:00:00.000Z",
      endAt: "2026-10-05T13:30:00.000Z",
      serviceMinutes: 240,
      bufferMinutes: 30,
      availabilityFresh: true,
    }]);
  });

  it("holds a slot from the exact quote duration and returns facade hold payload", async () => {
    const inserted: string[] = [];
    const methods = createCapacityFacadeMethods({
      now: () => now,
      requestRepository: { findById: async () => ({ ok: true, value: request }) },
      quoteRepository: {
        findById: async () => quote,
        findLatestByRequest: async () => quote,
      },
      capacityRepository: {
        nextHoldId: () => "hold_1",
        findSlotById: async () => ({ ok: true, value: {
          id: "slot_1",
          workspaceId: "ws_1",
          crewId: "crew_1",
          startsAt: "2026-10-05T09:00:00.000Z",
          endsAt: "2026-10-05T13:30:00.000Z",
          capacityMinutes: 270,
        } }),
        listActiveHoldsForSlot: async () => ({ ok: true, value: [] }),
        insertHold: async (hold) => {
          inserted.push(`${hold.id}:${hold.quoteId}:${hold.expiresAt}`);
          return { ok: true, value: hold };
        },
        listSlots: async () => ({ ok: true, value: [] }),
        listActiveHoldsForWindow: async () => ({ ok: true, value: [] }),
      },
    });

    await expect(methods.holdSlot(owner, "slot_1", "quote_1", { idempotencyKey: "idem", now })).resolves.toEqual({
      ok: true,
      value: { holdId: "hold_1", expiresAt: "2026-10-04T06:15:00.000Z" },
    });
    expect(inserted).toEqual(["hold_1:quote_1:2026-10-04T06:15:00.000Z"]);
  });

  it("fails closed when a repository returns a cross-workspace slot", async () => {
    const inserted: SlotHold[] = [];
    const crossWorkspaceSlot: CapacitySlot = {
      id: "slot_1",
      workspaceId: "ws_2",
      crewId: "crew_1",
      startsAt: "2026-10-05T09:00:00.000Z",
      endsAt: "2026-10-05T13:30:00.000Z",
      capacityMinutes: 270,
    };

    await expect(holdSlotWithRepository(owner, {
      slotId: "slot_1",
      quoteId: "quote_1",
      quoteWorkspaceId: "ws_1",
      durationMinutes: 240,
      bufferMinutes: 30,
    }, { idempotencyKey: "idem", now }, {
      nextHoldId: () => "hold_1",
      findSlotById: async () => ({ ok: true, value: crossWorkspaceSlot }),
      listActiveHoldsForSlot: async () => ({ ok: true, value: [] }),
      insertHold: async (hold) => { inserted.push(hold); return { ok: true, value: hold }; },
    })).resolves.toEqual({ ok: false, code: "SLOT_WORKSPACE_MISMATCH", message: "Slot does not belong to this workspace." });
    expect(inserted).toHaveLength(0);
  });
});
