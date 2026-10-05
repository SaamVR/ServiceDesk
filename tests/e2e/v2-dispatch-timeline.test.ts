import { describe, expect, it } from "vitest";
import type { DispatchSnapshot } from "../../src/features/dispatch/recommendations";
import { buildCrewDayTimeline } from "../../src/features/dispatch/timeline";

function snapshot(): DispatchSnapshot {
  return {
    crews: [
      { id: "crew_b", workspaceId: "ws_1", active: true },
      { id: "crew_a", workspaceId: "ws_1", active: true },
    ],
    visits: [
      {
        id: "visit_a1",
        workspaceId: "ws_1",
        requestId: "req_a1",
        quoteId: "quote_a1",
        crewId: "crew_a",
        status: "ASSIGNED",
        startAt: "2026-10-05T09:00:00.000Z",
        serviceMinutes: 120,
        bufferMinutes: 30,
        version: 2,
      },
      {
        id: "visit_a2",
        workspaceId: "ws_1",
        requestId: "req_a2",
        quoteId: "quote_a2",
        crewId: "crew_a",
        status: "EN_ROUTE",
        startAt: "2026-10-05T10:30:00.000Z",
        serviceMinutes: 60,
        bufferMinutes: 15,
        version: 4,
      },
      {
        id: "visit_b1",
        workspaceId: "ws_1",
        requestId: "req_b1",
        quoteId: "quote_b1",
        crewId: "crew_b",
        status: "COMPLETED",
        startAt: "2026-10-05T08:00:00.000Z",
        serviceMinutes: 45,
        bufferMinutes: 15,
        version: 7,
      },
    ],
  };
}

describe("V2 dispatcher crew/day timeline", () => {
  it("is deterministic, sorts lanes, computes workload, and exposes schedule collisions", () => {
    const input = snapshot();
    const before = JSON.stringify(input);
    const first = buildCrewDayTimeline(input);
    const second = buildCrewDayTimeline(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
    expect(first.map((lane) => lane.crewId)).toEqual(["crew_a", "crew_b"]);

    const crewA = first[0]!;
    expect(crewA.workloadMinutes).toBe(225);
    expect(crewA.conflictCount).toBe(2);
    expect(crewA.visits[0]?.conflictWithVisitIds).toEqual(["visit_a2"]);
    expect(crewA.visits[1]?.conflictWithVisitIds).toEqual(["visit_a1"]);

    const crewB = first[1]!;
    expect(crewB.workloadMinutes).toBe(60);
    expect(crewB.conflictCount).toBe(0);
    expect(crewB.visits[0]?.endAt).toBe("2026-10-05T09:00:00.000Z");
  });
});
