import { describe, expect, it } from "vitest";
import {
  createSlotHold,
  expandWeeklyRecurrence,
  findAvailableSlots,
  type CapacitySlot,
  type SlotHold,
} from "../../src/domain/capacity";

const slots: CapacitySlot[] = [
  {
    id: "slot_1",
    workspaceId: "ws_1",
    crewId: "crew_1",
    startsAt: "2026-10-05T09:00:00.000Z",
    endsAt: "2026-10-05T13:00:00.000Z",
    capacityMinutes: 240,
  },
  {
    id: "slot_2",
    workspaceId: "ws_1",
    crewId: "crew_1",
    startsAt: "2026-10-05T14:00:00.000Z",
    endsAt: "2026-10-05T18:30:00.000Z",
    capacityMinutes: 270,
  },
];

describe("capacity and slot holds", () => {
  it("returns only slots that can fit service duration plus buffer", () => {
    expect(findAvailableSlots({
      workspaceId: "ws_1",
      slots,
      existingHolds: [],
      durationMinutes: 240,
      bufferMinutes: 30,
      now: "2026-10-04T06:00:00.000Z",
    }).map((slot) => slot.id)).toEqual(["slot_2"]);
  });

  it("excludes past, now-starting and malformed slot windows", () => {
    const now = "2026-10-04T06:00:00.000Z";
    const unsafeSlots: CapacitySlot[] = [
      {
        id: "slot_past",
        workspaceId: "ws_1",
        crewId: "crew_1",
        startsAt: "2026-10-04T04:00:00.000Z",
        endsAt: "2026-10-04T08:30:00.000Z",
        capacityMinutes: 270,
      },
      {
        id: "slot_now",
        workspaceId: "ws_1",
        crewId: "crew_1",
        startsAt: now,
        endsAt: "2026-10-04T10:30:00.000Z",
        capacityMinutes: 270,
      },
      {
        id: "slot_invalid",
        workspaceId: "ws_1",
        crewId: "crew_1",
        startsAt: "2026-10-05T13:30:00.000Z",
        endsAt: "2026-10-05T09:00:00.000Z",
        capacityMinutes: 270,
      },
      {
        id: "slot_future",
        workspaceId: "ws_1",
        crewId: "crew_1",
        startsAt: "2026-10-05T09:00:00.000Z",
        endsAt: "2026-10-05T13:30:00.000Z",
        capacityMinutes: 270,
      },
    ];

    expect(findAvailableSlots({
      workspaceId: "ws_1",
      slots: unsafeSlots,
      existingHolds: [],
      durationMinutes: 240,
      bufferMinutes: 30,
      now,
    }).map((slot) => slot.id)).toEqual(["slot_future"]);
  });

  it("prevents the last slot race with active non-expired holds", () => {
    const activeHold: SlotHold = {
      id: "hold_existing",
      workspaceId: "ws_1",
      slotId: "slot_2",
      quoteId: "quote_existing",
      expiresAt: "2026-10-04T06:15:00.000Z",
      status: "HELD",
    };

    expect(createSlotHold({
      workspaceId: "ws_1",
      slotId: "slot_2",
      quoteId: "quote_new",
      now: "2026-10-04T06:10:00.000Z",
      holdMinutes: 15,
      existingHolds: [activeHold],
      createId: () => "hold_unused",
    })).toEqual({
      ok: false,
      code: "SLOT_ALREADY_HELD",
      message: "Slot already has an active hold.",
    });

    expect(createSlotHold({
      workspaceId: "ws_1",
      slotId: "slot_2",
      quoteId: "quote_new",
      now: "2026-10-04T06:16:00.000Z",
      holdMinutes: 15,
      existingHolds: [activeHold],
      createId: () => "hold_new",
    })).toMatchObject({
      ok: true,
      value: {
        id: "hold_new",
        slotId: "slot_2",
        quoteId: "quote_new",
        expiresAt: "2026-10-04T06:31:00.000Z",
        status: "HELD",
      },
    });
  });

  it("rejects zero, negative and non-integer hold durations", () => {
    for (const holdMinutes of [0, -1, 1.5]) {
      expect(createSlotHold({
        workspaceId: "ws_1",
        slotId: "slot_2",
        quoteId: "quote_new",
        now: "2026-10-04T06:16:00.000Z",
        holdMinutes,
        existingHolds: [],
        createId: () => "hold_unused",
      })).toEqual({
        ok: false,
        code: "HOLD_DURATION_INVALID",
        message: "Hold duration must be a positive integer number of minutes.",
      });
    }
  });

  it("expands weekly recurrence using explicit timezone-aware local start times", () => {
    expect(expandWeeklyRecurrence({
      firstLocalStart: "2026-10-05T09:00:00+01:00",
      occurrences: 3,
      durationMinutes: 240,
      timezone: "Europe/London",
    })).toEqual([
      { startsAt: "2026-10-05T08:00:00.000Z", endsAt: "2026-10-05T12:00:00.000Z", timezone: "Europe/London" },
      { startsAt: "2026-10-12T08:00:00.000Z", endsAt: "2026-10-12T12:00:00.000Z", timezone: "Europe/London" },
      { startsAt: "2026-10-19T08:00:00.000Z", endsAt: "2026-10-19T12:00:00.000Z", timezone: "Europe/London" },
    ]);
  });
});
