import { describe, expect, it } from "vitest";
import { buildDispatchStaffModule } from "../../src/features/dispatch/staff-integration";
import type { DispatchSnapshot } from "../../src/features/dispatch/recommendations";

describe("V2 dispatch staff integration seam", () => {
  it("composes recommendations and crew timeline without mutating the source snapshot", () => {
    const snapshot: DispatchSnapshot = {
      visits: [
        {
          id: "visit_unassigned",
          workspaceId: "ws_1",
          requestId: "req_1",
          quoteId: "quote_1",
          status: "CONFIRMED",
          startAt: "2026-10-05T14:00:00.000Z",
          serviceMinutes: 60,
          bufferMinutes: 15,
          version: 1,
        },
        {
          id: "visit_assigned",
          workspaceId: "ws_1",
          requestId: "req_2",
          quoteId: "quote_2",
          crewId: "crew_1",
          status: "ASSIGNED",
          startAt: "2026-10-05T09:00:00.000Z",
          serviceMinutes: 90,
          bufferMinutes: 30,
          version: 2,
        },
      ],
      crews: [{ id: "crew_1", workspaceId: "ws_1", active: true }],
    };
    const before = JSON.stringify(snapshot);
    const view = buildDispatchStaffModule(snapshot);

    expect(view.unassignedCount).toBe(1);
    expect(view.eligibleRecommendationCount).toBe(1);
    expect(view.timeline).toHaveLength(1);
    expect(view.humanApprovalRequired).toBe(true);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});
