import { describe, expect, it } from "vitest";
import type { CapacitySlot, SlotHold } from "../../src/domain/capacity";
import type { VisitRecord } from "../../src/server/core/visits";
import {
  createPostgresVisitRepository,
  mapCapacitySlotRowToRecord,
  mapSlotHoldRowToRecord,
  mapVisitRecordToRow,
  mapVisitRowToRecord,
} from "../../src/server/core/visit-repository";

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

const visit: VisitRecord = {
  id: "visit_1",
  workspaceId: "ws_1",
  requestId: "req_1",
  quoteId: "quote_1",
  slotId: "slot_1",
  holdId: "hold_1",
  crewId: "crew_1",
  status: "SCHEDULED",
  startsAt: "2026-10-05T09:00:00.000Z",
  endsAt: "2026-10-05T13:30:00.000Z",
  timezone: "Europe/London",
  version: 1,
  createdAt: "2026-10-04T06:00:00.000Z",
  updatedAt: "2026-10-04T06:00:00.000Z",
};

describe("visit persistence adapter", () => {
  it("maps rows to records without losing slot, hold, and visit state", () => {
    expect(mapCapacitySlotRowToRecord({
      id: "slot_1",
      workspace_id: "ws_1",
      crew_id: "crew_1",
      starts_at: "2026-10-05T09:00:00.000Z",
      ends_at: "2026-10-05T13:30:00.000Z",
      capacity_minutes: 270,
    })).toEqual(slot);

    expect(mapSlotHoldRowToRecord({
      id: "hold_1",
      workspace_id: "ws_1",
      slot_id: "slot_1",
      quote_id: "quote_1",
      expires_at: "2026-10-04T06:15:00.000Z",
      status: "HELD",
    })).toEqual(hold);

    expect(mapVisitRowToRecord(mapVisitRecordToRow(visit))).toEqual(visit);
  });

  it("scopes hold, slot, confirmation, and visit insert through a table gateway", async () => {
    const calls: string[] = [];
    const repo = createPostgresVisitRepository({
      nextVisitId: () => "visit_2",
      findHoldById: async (workspaceId, holdId) => {
        calls.push(`findHold:${workspaceId}:${holdId}`);
        return { data: {
          id: hold.id,
          workspace_id: hold.workspaceId,
          slot_id: hold.slotId,
          quote_id: hold.quoteId,
          expires_at: hold.expiresAt,
          status: hold.status,
        }, error: null };
      },
      findSlotById: async (workspaceId, slotId) => {
        calls.push(`findSlot:${workspaceId}:${slotId}`);
        return { data: {
          id: slot.id,
          workspace_id: slot.workspaceId,
          crew_id: slot.crewId,
          starts_at: slot.startsAt,
          ends_at: slot.endsAt,
          capacity_minutes: slot.capacityMinutes,
        }, error: null };
      },
      confirmHold: async (workspaceId, holdId) => {
        calls.push(`UNSAFE_CONFIRM:${workspaceId}:${holdId}`);
        return { data: null, error: null };
      },
      insertVisit: async (row) => {
        calls.push(`UNSAFE_INSERT:${row.workspace_id}:${row.id}`);
        return { data: row, error: null };
      },
      commitScheduledVisit: async (row, paymentId) => {
        calls.push(`atomic:${row.workspace_id}:${paymentId}`);
        return { data: {
          visit: row,
          hold: {
            id: hold.id, workspace_id: hold.workspaceId,
            slot_id: hold.slotId, quote_id: hold.quoteId,
            expires_at: hold.expiresAt, status: "CONFIRMED" as const,
          },
        }, error: null };
      },
    });

    await expect(repo.findHoldById("ws_1", "hold_1")).resolves.toEqual({ ok: true, value: hold });
    await expect(repo.findSlotById("ws_1", "slot_1")).resolves.toEqual({ ok: true, value: slot });
    await expect(repo.commitScheduledVisit!(visit, "payment_applied_1",
      { idempotencyKey: "idem", now: visit.createdAt })).resolves.toEqual({
      ok: true,
      value: {visit,confirmedHold:{...hold,status:"CONFIRMED"}},
    });

    expect(repo.nextVisitId()).toBe("visit_2");
    expect(calls).toEqual([
      "findHold:ws_1:hold_1",
      "findSlot:ws_1:slot_1",
      "atomic:ws_1:payment_applied_1",
    ]);
  });
  it("never falls back to split writes if the gateway lacks an atomic transaction", async () => {
    const unsafe = createPostgresVisitRepository({
      nextVisitId:()=> "visit_3",
      findHoldById: async()=> ({data:null,error:null}),
      findSlotById: async()=> ({data:null,error:null}),
      confirmHold: async()=> {throw new Error("unsafe confirm");},
      insertVisit: async()=> {throw new Error("unsafe visit");},
    });
    await expect(unsafe.commitScheduledVisit!(visit,"payment_applied_1",
      {idempotencyKey:"block-split",now:visit.createdAt})).resolves.toMatchObject({
        ok:false,code:"ATOMIC_VISIT_UNAVAILABLE",
      });
  });

  it("rejects atomic gateway receipts with an unconfirmed or foreign hold", async () => {
    for(const status of ["HELD","RELEASED"] as const){
      const gateway=createPostgresVisitRepository({
        nextVisitId:()=> "visit_4",
        findHoldById:async()=>({data:null,error:null}),
        findSlotById:async()=>({data:null,error:null}),
        commitScheduledVisit:async(row)=>({data:{
          visit:row,hold:{
            id:hold.id,workspace_id:hold.workspaceId,
            quote_id:hold.quoteId,slot_id:hold.slotId,
            expires_at:hold.expiresAt,status,
          },
        },error:null}),
      });
      await expect(gateway.commitScheduledVisit!(visit,"payment_applied_1",
        {idempotencyKey:"forge",now:visit.createdAt})).resolves.toMatchObject({
          ok:false,code:"ATOMIC_VISIT_READBACK_INVALID",
        });
    }
  });

});
