import { describe, expect, it, vi } from "vitest";
import { createPostgresConversationFacadeMethods } from "../../src/server/core/conversation-postgres";
import type { ActorContext } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const workspace = "11111111-1111-4111-8111-111111111111";
const ctx = {
  workspaceId: workspace, userId: "22222222-2222-4222-8222-222222222222", role: "OWNER",
} as ActorContext;
const rule = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: workspace,
  requestId: "44444444-4444-4444-8444-444444444444",
  propertyId: "55555555-5555-4555-8555-555555555555",
  frequency: "WEEKLY", timezone: "Asia/Dhaka",
  localStartTime: "09:30:00.123456",
  startsOn: "2028-02-29", endsOn: null,
  maxOccurrences: null, generatedOccurrences: 0,
  status: "ACTIVE", nextOccurrenceOn: null,
  version: 1,
  createdAt: "2026-10-17T08:00:00.000Z",
  updatedAt: "2026-10-17T08:00:00.000+00:00",
};
function read(saved: unknown) {
  const rpc = vi.fn().mockResolvedValue({
    data: { ok: true, recurrenceRules: [saved] }, error: null,
  });
  return createPostgresConversationFacadeMethods({ rpc } as unknown as SupabaseRpcClient)
    .readWorkspaceSnapshot(ctx, {});
}
const malformed = { ok: false, code: "SNAPSHOT_RPC_ERROR_MALFORMED" } as const;

describe("R17E authoritative recurrence snapshot projection (#552)", () => {
  it("preserves legitimate saved zero occurrences, positive version and nullable limits", async () => {
    const result = await read(rule);
    expect(result).toMatchObject({ ok: true, value: { recurrenceRules: [{
      id: rule.id, generatedOccurrences: 0, version: 1, startsOn: "2028-02-29",
      localStartTime: "09:30:00.123456", timezone: "Asia/Dhaka",
    }] } });
    if (result.ok) {
      expect(result.value.recurrenceRules[0].maxOccurrences).toBeUndefined();
      expect(result.value.recurrenceRules[0].endsOn).toBeUndefined();
      expect(result.value.recurrenceRules[0].nextOccurrenceOn).toBeUndefined();
    }
  });

  it("accepts installed PostgreSQL TIME forms, real DATE ranges and optional counts", async () => {
    for (const localStartTime of ["09:30", "09:30:00", "09:30:00.1", "09:30:00.123456"]) {
      const result = await read({ ...rule, localStartTime, endsOn: "2028-03-29",
        nextOccurrenceOn: "2028-03-07", maxOccurrences: 20 });
      expect(result, localStartTime).toMatchObject({ ok: true, value: {
        recurrenceRules: [{ localStartTime, endsOn: "2028-03-29",
          nextOccurrenceOn: "2028-03-07", maxOccurrences: 20 }],
      } });
    }
  });

  it("retains snake_case SQL projection rather than inventing absent camel fields", async () => {
    const snake = {
      id: rule.id, workspace_id: workspace, request_id: rule.requestId,
      property_id: rule.propertyId, frequency: rule.frequency, timezone: rule.timezone,
      local_start_time: "09:30:00", starts_on: "2028-02-29",
      ends_on: null, max_occurrences: null, generated_occurrences: 0,
      status: "ACTIVE", next_occurrence_on: null, version: 1,
      created_at: rule.createdAt, updated_at: rule.updatedAt,
    };
    expect(await read(snake)).toMatchObject({ ok: true,
      value: { recurrenceRules: [{ generatedOccurrences: 0, version: 1 }] } });
  });

  it("rejects absent, null, string, float and negative occurrence/version proof", async () => {
    for (const patch of [
      { generatedOccurrences: undefined }, { generatedOccurrences: null },
      { generatedOccurrences: "0" }, { generatedOccurrences: -1 },
      { generatedOccurrences: 0.5 }, { generatedOccurrences: NaN },
      { version: undefined }, { version: null }, { version: "1" },
      { version: 0 }, { version: -1 }, { version: 1.5 },
      { version: Number.MAX_SAFE_INTEGER + 1 },
      { maxOccurrences: 0 }, { maxOccurrences: -1 },
      { maxOccurrences: "3" }, { maxOccurrences: 2.4 },
    ]) {
      expect(await read({ ...rule, ...patch }), JSON.stringify(patch)).toMatchObject(malformed);
    }
  });

  it("rejects nonexistent recurrence identity, IANA timezone and unknown enums", async () => {
    for (const patch of [
      { id: undefined }, { workspaceId: undefined }, { requestId: null },
      { propertyId: "" }, { id: 123 },
      { timezone: undefined }, { timezone: "Mars/Olympus" },
      { frequency: "DAILY" }, { frequency: 5 },
      { status: "PENDING" }, { status: undefined },
      { createdAt: undefined }, { updatedAt: "tomorrow" },
    ]) expect(await read({ ...rule, ...patch }), JSON.stringify(patch)).toMatchObject(malformed);
  });

  it("rejects normalized impossible calendar dates and inverted ranges", async () => {
    for (const patch of [
      { startsOn: "2026-02-30" }, { startsOn: "2025-02-29" },
      { startsOn: "2028-04-31" }, { startsOn: "2028-00-01" },
      { startsOn: "2028-13-01" }, { startsOn: "2028-01-00" },
      { startsOn: "2028-01-32" }, { startsOn: "tomorrow" },
      { endsOn: "2026-02-30" }, { nextOccurrenceOn: "2028-02-30" },
      { endsOn: "2028-02-28" }, { endsOn: 123 },
    ]) expect(await read({ ...rule, ...patch }), JSON.stringify(patch)).toMatchObject(malformed);
  });

  it("refuses impossible saved local times and excess PostgreSQL precision", async () => {
    for (const localStartTime of [
      "", "24:00", "09:60", "09:30:60", "9:30", "09:30.1",
      "09:30:00.1234567", "09:30:00Z", "99:00:00",
    ]) expect(await read({ ...rule, localStartTime }), localStartTime).toMatchObject(malformed);
  });

  it("does not conceal a foreign tenant recurrence as an empty schedule", async () => {
    expect(await read({ ...rule, workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }))
      .toMatchObject({ ok: false, code: "SNAPSHOT_RPC_SCOPE_MISMATCH" });
  });
});
