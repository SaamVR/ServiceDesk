import { describe, expect, it } from "vitest";
import type { ResolvedStaffActor } from "../../src/features/operations/operational-product-runtime";
import { readOperationalDeliveryTriage } from "../../src/server/integrations/whatsapp/delivery-triage";

const outbound = [
  { id: "msg1", workspace_id: "ws1", conversation_id: "conv1", direction: "OUTBOUND",
    delivery_state: "QUEUED", created_at: "2026-10-11T05:00:00Z", body: "private details" },
  { id: "msg2", workspace_id: "ws1", conversation_id: "conv2", direction: "OUTBOUND",
    delivery_state: "FAILED", created_at: "2026-10-11T05:58:00Z", recipient: "private-recipient" },
  { id: "msg3", workspace_id: "ws1", conversation_id: "conv2", direction: "OUTBOUND",
    delivery_state: "READ", created_at: "2026-10-11T05:00:00Z" },
  { id: "msg4", workspace_id: "ws1", conversation_id: "conv1", direction: "OUTBOUND",
    delivery_state: "PROVIDER_ACCEPTED", created_at: "2026-10-11T05:50:00Z" },
];
const conversations = [
  { id: "conv1", workspace_id: "ws1", channel: "WHATSAPP", request_id: "req1" },
  { id: "conv2", workspace_id: "ws1", channel: "EMAIL", request_id: "req2" },
];
const requests = [
  { id: "req1", workspace_id: "ws1", branch_id: "north" },
  { id: "req2", workspace_id: "ws1", branch_id: "south" },
];
function fixture(options: {
  rows?: Array<Record<string, unknown>>;
  conversations?: Array<Record<string, unknown>>;
  requests?: Array<Record<string, unknown>>;
  branch?: string; role?: "OWNER" | "DISPATCHER" | "CREW";
  authorized?: boolean; failTable?: string;
} = {}) {
  const seen: string[] = [];
  const scoped: Array<[string, unknown]> = [];
  const source: Record<string, Array<Record<string, unknown>>> = {
    messages: options.rows ?? outbound,
    conversations: options.conversations ?? conversations,
    requests: options.requests ?? requests,
  };
  const service = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const query = {
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          scoped.push([column, value]);
          return this;
        },
        in() { return this; },
        order() { return this; },
        async limit(limit: number) {
          seen.push(table);
          if (options.failTable === table) return { data: null, error: { message: "secret DB details" } };
          return { data: (source[table] ?? []).slice(0, limit), error: null };
        },
      };
      return { select: () => query };
    },
  };
  const resolved = {
    actor: { userId: "user1", workspaceId: "ws1", role: options.role ?? "OWNER" },
    workspace: { id: "ws1", slug: "service-desk", name: "Desk" },
    service,
    branchScope: options.branch
      ? { mode: "BRANCH", selectedBranchId: options.branch, branches: [] }
      : { mode: "ALL", branches: [] },
  } as unknown as ResolvedStaffActor;
  const deps = {
    resolveActor: async (_slug: string) => options.authorized === false
      ? { ok: false as const, kind: "auth", message: "Not signed in" }
      : { ok: true as const, value: resolved },
    now: () => new Date("2026-10-11T06:00:00Z"),
  };
  return { deps, seen, scoped };
}
describe("real outbound delivery triage", () => {
  it("reports age, review, pending and completed states without customer details", async () => {
    const h = fixture();
    const result = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(result).toMatchObject({ ok: true, value: {
      workspaceId: "ws1", truncated: false,
      scannedOutboundMessages: 4, counts: { ok: 1, pending: 1, review: 2 },
      items: [
        { messageId: "msg1", ageMinutes: 60, health: "NEEDS_REVIEW", reason: "STALE_PENDING" },
        { messageId: "msg2", health: "NEEDS_REVIEW", reason: "PROVIDER_FAILURE", channel: "EMAIL" },
        { messageId: "msg3", health: "OK" },
        { messageId: "msg4", health: "PENDING" },
      ],
    } });
    expect(JSON.stringify(result)).not.toMatch(/private details|private-recipient/);
    expect(h.scoped).toContainEqual(["workspace_id", "ws1"]);
    expect(h.seen).toEqual(["messages", "conversations"]);
  });

  it("filters an assigned dispatcher branch before exposing message IDs or counts", async () => {
    const h = fixture({ role: "DISPATCHER", branch: "north" });
    const result = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(result).toMatchObject({ ok: true, value: {
      counts: { ok: 0, pending: 1, review: 1 },
      scannedOutboundMessages: 2, truncated: true,
      items: [{ messageId: "msg1" }, { messageId: "msg4" }],
    } });
    expect(JSON.stringify(result)).not.toContain("msg2");
    expect(h.seen).toEqual(["messages", "conversations", "requests"]);
  });

  it("honors selected owner branch as well as dispatcher branch", async () => {
    const h = fixture({ role: "OWNER", branch: "south" });
    const result = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(result).toMatchObject({ ok: true, value: {
      counts: { ok: 1, pending: 0, review: 1 },
      scannedOutboundMessages: 2, truncated: true,
      items: [{ messageId: "msg2" }, { messageId: "msg3" }],
    } });
  });

  it("does not disclose workspace-wide volume when a branch has no authorized records", async () => {
    const h = fixture({ role: "DISPATCHER", branch: "unassigned" });
    const result = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(result).toMatchObject({ ok: true, value: {
      scannedOutboundMessages: 0, truncated: true,
      counts: { ok: 0, pending: 0, review: 0 }, items: [],
    } });
    expect(JSON.stringify(result)).not.toMatch(/msg1|msg2|msg3|msg4/);
  });

  it("does not read database for unauthenticated, crew or invalid workspace scopes", async () => {
    for (const h of [
      fixture({ authorized: false }), fixture({ role: "CREW" }),
      fixture({ role: "DISPATCHER" }),
    ]) {
      expect((await readOperationalDeliveryTriage("service-desk", h.deps)).ok).toBe(false);
      expect(h.seen).toEqual([]);
    }
    const h = fixture();
    expect(await readOperationalDeliveryTriage("../foreign", h.deps))
      .toMatchObject({ ok: false, code: "DELIVERY_TRIAGE_WORKSPACE_INVALID" });
    expect(h.seen).toEqual([]);
  });

  it("does not return data for missing or foreign conversations or malformed statuses", async () => {
    for (const h of [
      fixture({ conversations: [{ ...conversations[0], workspace_id: "ws-other" }, conversations[1]] }),
      fixture({ conversations: [conversations[0]] }),
      fixture({ rows: [{ ...outbound[0], workspace_id: "foreign" }] }),
      fixture({ rows: [{ ...outbound[0], delivery_state: "UNVERIFIED" }] }),
    ]) {
      expect((await readOperationalDeliveryTriage("service-desk", h.deps)).ok).toBe(false);
    }
  });

  it("classifies historical null delivery state as unknown requiring review, not a fabricated provider acknowledgement", async () => {
    const h = fixture({ rows: [{ ...outbound[0], delivery_state: null }] });
    expect(await readOperationalDeliveryTriage("service-desk", h.deps)).toMatchObject({
      ok: true, value: { counts: { ok: 0, pending: 0, review: 1 },
        items: [{ deliveryState: "UNKNOWN", health: "NEEDS_REVIEW", reason: "STATUS_MISSING" }],
      },
    });
  });

  it("returns zero counts and does not query unrelated tables for no outgoing messages", async () => {
    const h = fixture({ rows: [] });
    expect(await readOperationalDeliveryTriage("service-desk", h.deps)).toMatchObject({
      ok: true, value: { scannedOutboundMessages: 0, counts: { ok: 0, pending: 0, review: 0 }, items: [] },
    });
    expect(h.seen).toEqual(["messages"]);
  });

  it("marks a bounded 200-row window as truncated and does not claim complete history", async () => {
    const h = fixture({ rows: Array.from({ length: 201 }, (_, index) =>
      ({ ...outbound[0], id: "msg-" + index })) });
    const result = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(result).toMatchObject({ ok: true, value: { scannedOutboundMessages: 200, truncated: true } });
    if (result.ok) expect(result.value.items).toHaveLength(200);
  });

  it("redacts raw PostgREST errors and does not report false success", async () => {
    const h = fixture({ failTable: "messages" });
    const result = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(result).toMatchObject({ ok: false, code: "DELIVERY_TRIAGE_MESSAGES_UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("secret DB details");
  });
});
