import type { DispatchSnapshot, DispatchVisitSnapshot } from "./recommendations";

export interface DispatchTimelineVisit {
  visitId: string;
  startAt: string;
  endAt: string;
  status: DispatchVisitSnapshot["status"];
  version: number;
  conflictWithVisitIds: string[];
}

export interface DispatchCrewDayLane {
  crewId: string;
  active: boolean;
  workloadMinutes: number;
  conflictCount: number;
  visits: DispatchTimelineVisit[];
}

function endAt(visit: DispatchVisitSnapshot) {
  return new Date(new Date(visit.startAt).getTime() + (visit.serviceMinutes + visit.bufferMinutes) * 60_000).toISOString();
}

function overlap(a: DispatchVisitSnapshot, b: DispatchVisitSnapshot) {
  const aStart = new Date(a.startAt).getTime();
  const aEnd = new Date(endAt(a)).getTime();
  const bStart = new Date(b.startAt).getTime();
  const bEnd = new Date(endAt(b)).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function buildCrewDayTimeline(snapshot: DispatchSnapshot): DispatchCrewDayLane[] {
  return [...snapshot.crews]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((crew) => {
      const assigned = snapshot.visits
        .filter((visit) => visit.crewId === crew.id && visit.status !== "CANCELLED")
        .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id));

      const visits = assigned.map((visit) => {
        const conflictWithVisitIds = assigned
          .filter((other) => other.id !== visit.id && overlap(visit, other))
          .map((other) => other.id)
          .sort();
        return {
          visitId: visit.id,
          startAt: visit.startAt,
          endAt: endAt(visit),
          status: visit.status,
          version: visit.version,
          conflictWithVisitIds,
        };
      });

      return {
        crewId: crew.id,
        active: crew.active,
        workloadMinutes: assigned.reduce((sum, visit) => sum + visit.serviceMinutes + visit.bufferMinutes, 0),
        conflictCount: visits.filter((visit) => visit.conflictWithVisitIds.length > 0).length,
        visits,
      };
    });
}
