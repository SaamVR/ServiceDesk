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

export function filterAvailableCalendarSlots<TSlot extends CalendarSlotWithId>(slots: TSlot[], busy: CalendarBusyRange[], buffer: CalendarSlotBuffer): TSlot[] {
  const freshBusy = busy.filter((block) => block.freshness === "FRESH");

  return slots.filter((slot) => {
    const buffered = expandCalendarSlotWithBuffer(slot, buffer);
    return !freshBusy.some((block) => calendarSlotOverlapsBusy(buffered, block));
  });
}
