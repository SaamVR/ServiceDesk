import { describe, expect, it, vi } from "vitest";
import { createPostgresVisitFieldRuntimeFacadeMethods } from "../../src/server/core/visit-field-postgres";

describe("V2 Postgres crew assignment adapter", () => {
  it("calls the dedicated authoritative assignment RPC with actor, version and idempotency metadata", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        visit: {
          id: "visit_1",
          workspaceId: "ws_1",
          requestId: "req_1",
          quoteId: "quote_1",
          crewId: "crew_2",
          status: "ASSIGNED",
          startAt: "2026-10-05T09:00:00.000Z",
          serviceMinutes: 120,
          bufferMinutes: 30,
          version: 8,
        },
      },
      error: null,
    });
    const facade = createPostgresVisitFieldRuntimeFacadeMethods({ rpc } as never);

    const result = await facade.assignCrew(
      { workspaceId: "ws_1", userId: "user_1", role: "DISPATCHER" },
      "visit_1",
      { crewId: "crew_2" },
      {
        expectedVersion: 7,
        idempotencyKey: "assign-1",
        now: "2026-10-05T08:00:00.000Z",
      },
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: "visit_1",
        crewId: "crew_2",
        status: "ASSIGNED",
        version: 8,
      }),
    });
    expect(rpc).toHaveBeenCalledWith("servicedesk_assign_visit_crew", {
      p_input: {
        workspaceId: "ws_1",
        actorRole: "DISPATCHER",
        actorUserId: "user_1",
        now: "2026-10-05T08:00:00.000Z",
        expectedVersion: 7,
        idempotencyKey: "assign-1",
        visitId: "visit_1",
        crewId: "crew_2",
      },
    });
  });
});
