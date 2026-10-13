import type { CalendarBusyRange } from "../types";

export interface CalendarInterval {
  startAt: string;
  endAt: string;
}

export interface CalendarSlotWithId extends CalendarInterval {
  id: string;
}

export interface CalendarSlotBuffer {
  beforeMinutes: number;
  afterMinutes: number;
}

function instantMs(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function validInterval(interval: CalendarInterval): { startMs: number; endMs: number } | null {
  const startMs = instantMs(interval.startAt);
  const endMs = instantMs(interval.endAt);
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  return { startMs, endMs };
}

export function calendarSlotOverlapsBusy(slot: CalendarInterval, busy: Pick<CalendarBusyRange, "startAt" | "endAt">): boolean {
  const slotRange = validInterval(slot);
  const busyRange = validInterval(busy);
  if (!slotRange || !busyRange) return true;

  return slotRange.startMs < busyRange.endMs && slotRange.endMs > busyRange.startMs;
}

export function expandCalendarSlotWithBuffer(slot: CalendarInterval, buffer: CalendarSlotBuffer): CalendarInterval {
  const range = validInterval(slot);
  if (!range) return slot;

  return {
    startAt: new Date(range.startMs - buffer.beforeMinutes * 60_000).toISOString(),
    endAt: new Date(range.endMs + buffer.afterMinutes * 60_000).toISOString(),
  };
}

/** The availability list is not a source of instant confirmation when any
 * external busy proof is stale, malformed or outside the supported buffer.
 * A guessed free slot is worse than an unavailable booking option.
 */
export function filterAvailableCalendarSlots<TSlot extends CalendarSlotWithId>(slots: TSlot[], busy: CalendarBusyRange[], buffer: CalendarSlotBuffer): TSlot[] {
  if (!Array.isArray(slots) || !Array.isArray(busy) ||
      !buffer || !Number.isSafeInteger(buffer.beforeMinutes) ||
      !Number.isSafeInteger(buffer.afterMinutes) ||
      buffer.beforeMinutes < 0 || buffer.afterMinutes < 0 ||
      buffer.beforeMinutes > 1440 || buffer.afterMinutes > 1440 ||
      busy.some(block => !block || block.freshness !== "FRESH" || !validInterval(block))) {
    return [];
  }

  return slots.filter((slot) => {
    if (!slot || !validInterval(slot)) return false;
    const buffered = expandCalendarSlotWithBuffer(slot, buffer);
    return validInterval(buffered) !== null &&
      !busy.some(block => calendarSlotOverlapsBusy(buffered, block));
  });
}
