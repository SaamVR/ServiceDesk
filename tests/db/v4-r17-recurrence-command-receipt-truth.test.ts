import { describe, expect, it, vi } from "vitest";
import { createPostgresRecurrenceFacadeMethods } from "../../src/server/core/recurrence-postgres";
import type { ActorContext } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const workspace = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const propertyId = "33333333-3333-4333-8333-333333333333";
const ruleId = "44444444-4444-4444-8444-444444444444";
const ctx = { workspaceId: workspace, userId: "55555555-5555-4555-8555-555555555555", role: "OWNER" } as ActorContext;
const meta = { idempotencyKey: "recurrence-command-001", now: "2026-10-17T10:00:00Z", expectedVersion: 1 };
const createInput = { requestId, propertyId, frequency: "WEEKLY" as const,
  timezone: "UTC", localStartTime: "09:30", startsOn: "2026-10-17" };
const saved = {
  id: ruleId, workspaceId: workspace, requestId, propertyId,
  frequency: "WEEKLY", timezone: "UTC", localStartTime: "09:30:00",
  startsOn: "2026-10-17", endsOn: null, maxOccurrences: null,
  generatedOccurrences: 0, status: "ACTIVE", nextOccurrenceOn: "2026-10-24",
  version: 1, createdAt: "2026-10-17T10:00:00Z",
  updatedAt: "2026-10-17T10:00:00Z",
};
function facade(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  return { rpc, api: createPostgresRecurrenceFacadeMethods({ rpc } as unknown as SupabaseRpcClient) };
}
function create(data: unknown) {
  return facade(data).api.createRecurrenceRule(ctx, createInput, meta);
}
function act(data: unknown) {
  return facade(data).api.applyRecurrenceRuleAction(ctx, ruleId, "PAUSE", meta);
}

describe("R17G persisted recurrence command receipt authority", () => {
  it("accepts real saved zero occurrences and positive version on create/action", async () => {
    expect(await create({ ok: true, rule: saved })).toMatchObject({ ok: true,
      value: { workspaceId: workspace, generatedOccurrences: 0, version: 1 } });
    expect(await act({ ok: true, rule: { ...saved, status: "PAUSED", version: 2 } }))
      .toMatchObject({ ok: true, value: { status: "PAUSED", version: 2 } });
    expect(await create({ ok: true, rule: { ...saved, maxOccurrences: 12 } }))
      .toMatchObject({ ok: true, value: { maxOccurrences: 12 } });
  });

  it("rejects malformed/nonpositive saved versions, counts and occurrence limits", async () => {
    for (const patch of [
      { generatedOccurrences: undefined }, { generatedOccurrences: -1 },
      { generatedOccurrences: 1.5 }, { generatedOccurrences: "0" },
      { generatedOccurrences: Number.POSITIVE_INFINITY },
      { version: undefined }, { version: 0 }, { version: -1 },
      { version: "1" }, { version: 2.5 }, { version: Number.MAX_SAFE_INTEGER + 1 },
      { maxOccurrences: 0 }, { maxOccurrences: -1 }, { maxOccurrences: 3.5 },
      { maxOccurrences: "10" }, { maxOccurrences: Number.POSITIVE_INFINITY },
    ]) {
      expect(await create({ ok: true, rule: { ...saved, ...patch } }),
        JSON.stringify(patch)).toMatchObject({
          ok: false, code: "RECURRENCE_CREATE_RPC_ERROR_MALFORMED",
      });
    }
  });

  it("refuses absent or forged RPC success rather than fabricating successful recurrence", async () => {
    for (const ok of [undefined, null, "true", 1, false]) {
      const result = await create({ ok, rule: saved });
      expect(result.ok, String(ok)).toBe(false);
    }
    for (const data of [null, {ok:true}, {ok:true,rule:[]}, {ok:true,rule:"fake"}]) {
      expect((await act(data)).ok).toBe(false);
    }
  });

  it("rejects cross-tenant, request and property substitution on create", async () => {
    for (const patch of [
      { workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      { propertyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
    ]) expect(await create({ ok: true, rule: { ...saved, ...patch } }))
      .toMatchObject({ ok: false, code: "RECURRENCE_CREATE_RPC_SCOPE_MISMATCH" });
  });

  it("rejects a different rule or tenant falsely returned after a PAUSE action", async () => {
    for (const patch of [
      { workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    ]) expect(await act({ ok: true, rule: { ...saved, status: "PAUSED",
      version: 2, ...patch } })).toMatchObject({
        ok: false, code: "RECURRENCE_ACTION_RPC_SCOPE_MISMATCH",
    });
  });
});
