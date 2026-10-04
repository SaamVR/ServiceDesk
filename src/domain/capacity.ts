import type { Result } from "../contracts";

export type SlotHoldStatus = "HELD" | "CONFIRMED" | "EXPIRED" | "RELEASED";

export interface CapacitySlot {
  id: string;
  workspaceId: string;
  crewId: string;
  startsAt: string;
  endsAt: string;
  capacityMinutes: number;
}

export interface SlotHold {
  id: string;
  workspaceId: string;
  slotId: string;
  quoteId: string;
  expiresAt: string;
  status: SlotHoldStatus;
}

export interface FindAvailableSlotsInput {
  workspaceId: string;
  slots: readonly CapacitySlot[];
  existingHolds: readonly SlotHold[];
  durationMinutes: number;
  bufferMinutes: number;
  now: string;
}

export interface CreateSlotHoldInput {
  workspaceId: string;
  slotId: string;
  quoteId: string;
  now: string;
  holdMinutes: number;
  existingHolds: readonly SlotHold[];
  createId: () => string;
}

export interface WeeklyRecurrenceInput {
  firstLocalStart: string;
  occurrences: number;
  durationMinutes: number;
  timezone: string;
}

export interface RecurringVisitOccurrence {
  startsAt: string;
  endsAt: string;
  timezone: string;
}

function parseTime(iso: string): number | undefined {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function minutesBetween(startsAt: string, endsAt: string): number {
  const start = parseTime(startsAt);
  const end = parseTime(endsAt);
  if (start === undefined || end === undefined) return Number.NaN;
  return Math.floor((end - start) / 60_000);
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function addDaysPreservingOffset(iso: string, days: number): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2}:\d{2}|Z)$/);
  if (!match) throw new Error("firstLocalStart must be an ISO timestamp with explicit offset");
  const [, year, month, day, time, fraction = "", offset] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days));
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}T${time}${fraction}${offset}`;
}

export function hasActiveHold(hold: SlotHold, now: string): boolean {
  if (hold.status !== "HELD") return false;
  return new Date(hold.expiresAt).getTime() > new Date(now).getTime();
}

export function findAvailableSlots(input: FindAvailableSlotsInput): CapacitySlot[] {
  const requiredMinutes = input.durationMinutes + input.bufferMinutes;
  const activeHeldSlotIds = new Set(
    input.existingHolds
      .filter((hold) => hold.workspaceId === input.workspaceId && hasActiveHold(hold, input.now))
      .map((hold) => hold.slotId),
  );

  return input.slots.filter((slot) => {
    if (slot.workspaceId !== input.workspaceId) return false;
    if (activeHeldSlotIds.has(slot.id)) return false;

    const now = parseTime(input.now);
    const startsAt = parseTime(slot.startsAt);
    const endsAt = parseTime(slot.endsAt);
    if (now === undefined || startsAt === undefined || endsAt === undefined) return false;
    if (startsAt <= now || endsAt <= now) return false;
    if (endsAt <= startsAt) return false;

    const windowMinutes = minutesBetween(slot.startsAt, slot.endsAt);
    return Number.isFinite(windowMinutes) && slot.capacityMinutes >= requiredMinutes && windowMinutes >= requiredMinutes;
  });
}

export function createSlotHold(input: CreateSlotHoldInput): Result<SlotHold> {
  if (!Number.isInteger(input.holdMinutes) || input.holdMinutes <= 0) {
    return {
      ok: false,
      code: "HOLD_DURATION_INVALID",
      message: "Hold duration must be a positive integer number of minutes.",
    };
  }

  const activeConflict = input.existingHolds.some((hold) => (
    hold.workspaceId === input.workspaceId
    && hold.slotId === input.slotId
    && hasActiveHold(hold, input.now)
  ));

  if (activeConflict) {
    return { ok: false, code: "SLOT_ALREADY_HELD", message: "Slot already has an active hold." };
  }

  return {
    ok: true,
    value: {
      id: input.createId(),
      workspaceId: input.workspaceId,
      slotId: input.slotId,
      quoteId: input.quoteId,
      expiresAt: addMinutes(input.now, input.holdMinutes),
      status: "HELD",
    },
  };
}

export function expandWeeklyRecurrence(input: WeeklyRecurrenceInput): RecurringVisitOccurrence[] {
  if (!Number.isInteger(input.occurrences) || input.occurrences < 1 || input.occurrences > 104) {
    throw new RangeError("occurrences must be an integer between 1 and 104");
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) {
    throw new RangeError("durationMinutes must be a positive integer");
  }

  return Array.from({ length: input.occurrences }, (_, index) => {
    const localStart = addDaysPreservingOffset(input.firstLocalStart, index * 7);
    const startsAt = new Date(localStart).toISOString();
    return {
      startsAt,
      endsAt: addMinutes(startsAt, input.durationMinutes),
      timezone: input.timezone,
    };
  });
}
