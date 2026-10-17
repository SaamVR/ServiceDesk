import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import { createPostgresConversationFacadeMethods } from "../../src/server/core/conversation-postgres";

const workspace = "11111111-1111-4111-8111-111111111111";
const ctx = { workspaceId: workspace, userId: "22222222-2222-4222-8222-222222222222", role: "OWNER" } as ActorContext;
const request = {
  id: "request-1", workspaceId: workspace, status: "READY",
  bedrooms: 2, bathrooms: 1, version: 1,
  requestedStartAt: "2026-10-21T09:30:00.123456+06:00",
  createdAt: "2026-10-16T12:00:00Z",
  updatedAt: "2026-10-16T12:30:00+00:00",
};
const visit = {
  id: "visit-1", workspaceId: workspace, requestId: request.id, quoteId: "quote-1",
  status: "CONFIRMED", startAt: "2026-10-21T09:30:00.123456+06:00",
  serviceMinutes: 120, bufferMinutes: 30, version: 1,
};
const message = {
  id: "message-1", workspaceId: workspace, conversationId: "conversation-1",
  direction: "INBOUND", senderKind: "CUSTOMER", deliveryState: "DELIVERED",
  createdAt: "2026-10-21T09:30:00+06:00",
};
const recurrenceRule = {
  id: "rule-1", workspaceId: workspace, requestId: request.id, propertyId: "property-1",
  frequency: "WEEKLY", timezone: "Asia/Dhaka", localStartTime: "09:30:00",
  startsOn: "2026-10-21", generatedOccurrences: 0, version: 1,
  status: "ACTIVE", createdAt: "2026-10-16T12:00:00Z",
  updatedAt: "2026-10-16T12:00:00Z",
};
type Patch = Record<string, unknown>;

async function snapshot(values: Record<string, unknown>) {
  const rpc = vi.fn().mockResolvedValue({ data: { ok: true, ...values }, error: null });
  return createPostgresConversationFacadeMethods({ rpc } as unknown as SupabaseRpcClient)
    .readWorkspaceSnapshot(ctx, {});
}

describe("R20A saved snapshot civil-valid zoned time boundary", () => {
  it("preserves real PostgreSQL microseconds and legitimate timezone offsets", async () => {
    for (const stamp of [
      "2024-02-29T23:59:59.123456Z", "2026-10-21T09:30:00.123456+06:00",
      "2026-10-21T09:30:00+14:00", "2026-10-21T09:30:00-12:00",
    ]) {
      expect(await snapshot({ requests: [{ ...request, createdAt: stamp }],
        visits: [{ ...visit, startAt: stamp }],
        messages: [{ ...message, createdAt: stamp }],
        recurrenceRules: [{ ...recurrenceRule, updatedAt: stamp }] }),
      stamp).toMatchObject({ ok: true, value: {
        requests: [{ createdAt: stamp }], visits: [{ startAt: stamp }],
        messages: [{ createdAt: stamp }], recurrenceRules: [{ updatedAt: stamp }],
      } });
    }
  });

  it("rejects calendar normalization, year zero and invalid clock components across saved entities", async () => {
    const invalid = [
      "2026-02-30T12:00:00Z", "2025-02-29T12:00:00Z",
      "2026-04-31T12:00:00Z", "2026-00-01T12:00:00Z",
      "2026-13-01T12:00:00Z", "0000-01-01T12:00:00Z",
      "2026-10-17T24:00:00Z", "2026-10-17T12:60:00Z",
      "2026-10-17T12:00:60Z", "2026-10-17T12:00:00+14:01",
      "2026-10-17T12:00:00+15:00", "2026-10-17T12:00:00+06:60",
      "2026-10-17T12:00:00", "2026-10-17",
      "2026-10-17 12:00:00Z", "2026-10-17T12:00:00.1234567Z",
      "2026-10-17T12:00:00+06", "not-a-timestamp",
    ];
    for (const stamp of invalid) {
      const variants: Patch[] = [
        { requests: [{ ...request, createdAt: stamp }] },
        { visits: [{ ...visit, startAt: stamp }] },
        { messages: [{ ...message, createdAt: stamp }] },
        { recurrenceRules: [{ ...recurrenceRule, updatedAt: stamp }] },
      ];
      for (const v of variants) {
        expect(await snapshot(v), JSON.stringify({ stamp, collection: Object.keys(v)[0] }))
          .toMatchObject({ ok: false, code: "SNAPSHOT_RPC_ERROR_MALFORMED" });
      }
    }
  });

  it("rejects ambiguous optional requested appointment timestamps rather than implying verified customer timing", async () => {
    for (const stamp of [
      "2026-02-30T08:00:00Z", "2026-10-17T08:00:00",
      "2026-10-17T08:00:00+14:30", 42, [], "2026-10-17 08:00:00Z",
    ]) {
      expect(await snapshot({ requests: [{ ...request, requestedStartAt: stamp }] }),
        String(stamp)).toMatchObject({ ok: false, code: "SNAPSHOT_RPC_ERROR_MALFORMED" });
    }
    expect(await snapshot({ requests: [{ ...request, requestedStartAt: null }] }))
      .toMatchObject({ ok: true, value: { requests: [{ id: request.id }] } });
  });

  it("still reports unrelated workspace data as a tenant mismatch", async () => {
    expect(await snapshot({ visits: [{ ...visit, workspaceId: "not-our-workspace" }] }))
      .toMatchObject({ ok: false, code: "SNAPSHOT_RPC_SCOPE_MISMATCH" });
  });
});
