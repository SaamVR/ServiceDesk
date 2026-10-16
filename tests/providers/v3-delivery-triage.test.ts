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
  outbox?: Array<Record<string, unknown>>;
  branch?: string; role?: "OWNER" | "DISPATCHER" | "CREW";
  authorized?: boolean; failTable?: string;
} = {}) {
  const seen: string[] = [];
  const scoped: Array<[string, unknown]> = [];
  const inclusions: Array<{ table: string; column: string; ids: unknown[] }> = [];
  const source: Record<string, Array<Record<string, unknown>>> = {
    messages: options.rows ?? outbound,
    conversations: options.conversations ?? conversations,
    requests: options.requests ?? requests,
    outbox_events: options.outbox ?? [],
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
        in(column: string, ids: unknown[]) { inclusions.push({ table, column, ids }); return this; },
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
  return { deps, seen, scoped, inclusions };
}
describe("real outbound delivery triage", () => {
  it("shows authoritative provider acceptance from a SENT outbox without misreporting delivery", async () => {
    const h = fixture({ rows: [{ ...outbound[0], outbox_event_id: "outbox1" }],
      outbox: [{ id: "outbox1", workspace_id: "ws1", topic: "conversation.reply",
        status: "SENT", provider_reference: "provider-ref-private" }],
    });
    const result = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(result).toMatchObject({ ok: true, value: {
      counts: { ok: 0, pending: 0, review: 1 },
      items: [{ messageId: "msg1", deliveryState: "PROVIDER_ACCEPTED",
        evidenceSource: "OUTBOX_PROVIDER_ACCEPTANCE", health: "NEEDS_REVIEW",
        reason: "STALE_PENDING" }],
    } });
    expect(h.seen).toEqual(["messages", "conversations", "outbox_events"]);
    expect(h.inclusions).toContainEqual({
      table: "outbox_events", column: "id", ids: ["outbox1"],
    });
    expect(JSON.stringify(result)).not.toContain("provider-ref-private");
  });

  it("derives terminal outbox failure without falsely changing the persisted message", async () => {
    for (const [state, expected] of [["FAILED", "FAILED"], ["SUPPRESSED", "SUPPRESSED"]] as const) {
      const h = fixture({ rows: [{ ...outbound[0], outbox_event_id: "outbox1" }],
        outbox: [{ id: "outbox1", workspace_id: "ws1", topic: "conversation.reply",
          status: state, provider_reference: null }],
      });
      const r = await readOperationalDeliveryTriage("service-desk", h.deps);
      expect(r).toMatchObject({ ok: true, value: {
        items: [{ deliveryState: expected, evidenceSource: "OUTBOX_TERMINAL",
          health: "NEEDS_REVIEW" }],
      } });
    }
  });

  it("loads outbox receipts only for the authenticated operator's branch", async () => {
    const h = fixture({ role: "DISPATCHER", branch: "north",
      rows: [
        { ...outbound[0], outbox_event_id: "north-outbox" },
        { ...outbound[1], outbox_event_id: "south-outbox" },
      ],
      outbox: [{ id: "north-outbox", workspace_id: "ws1",
        topic: "conversation.reply", status: "SENT", provider_reference: "north-ref" }],
    });
    const r = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(r).toMatchObject({ ok: true, value: {
      scannedOutboundMessages: 1, truncated: true, items: [
        { messageId: "msg1", evidenceSource: "OUTBOX_PROVIDER_ACCEPTANCE" },
      ],
    } });
    expect(h.inclusions).toContainEqual({
      table: "outbox_events", column: "id", ids: ["north-outbox"],
    });
    expect(JSON.stringify(r)).not.toContain("south-outbox");
  });

  it("fails closed on foreign or ambiguous outbox source rows", async () => {
    for (const bad of [
      [{ id: "outbox1", workspace_id: "foreign",
        topic: "conversation.reply", status: "SENT", provider_reference: "ref" }],
      [{ id: "outbox1", workspace_id: "ws1",
        topic: "conversation.reply", status: "SENT", provider_reference: "ref" },
       { id: "outbox1", workspace_id: "ws1",
        topic: "conversation.reply", status: "SENT", provider_reference: "ref" }],
    ]) {
      const h = fixture({ rows: [{ ...outbound[0], outbox_event_id: "outbox1" }], outbox: bad });
      expect((await readOperationalDeliveryTriage("service-desk", h.deps)).ok).toBe(false);
    }
  });

  it("rejects one persisted outbox event reused for two different outbound messages", async () => {
    const h = fixture({
      rows: [
        { ...outbound[0], outbox_event_id: "outbox1" },
        { ...outbound[1], outbox_event_id: "outbox1" },
      ],
      outbox: [{ id: "outbox1", workspace_id: "ws1", topic: "conversation.reply",
        status: "SENT", provider_reference: "one-provider-receipt" }],
    });
    expect(await readOperationalDeliveryTriage("service-desk", h.deps)).toMatchObject({
      ok: false, code: "DELIVERY_TRIAGE_OUTBOX_MESSAGE_AMBIGUOUS",
    });
    // Invalid fanout is rejected before querying or treating a provider
    // acceptance receipt as proof of either customer's delivery.
    expect(h.seen).toEqual(["messages", "conversations"]);
  });

  it("accepts independent outbox receipts for separate outbound messages", async () => {
    const h = fixture({
      rows: [
        { ...outbound[0], outbox_event_id: "outbox1" },
        { ...outbound[1], outbox_event_id: "outbox2" },
      ],
      outbox: [
        { id: "outbox1", workspace_id: "ws1", topic: "conversation.reply",
          status: "SENT", provider_reference: "ref-a" },
        { id: "outbox2", workspace_id: "ws1", topic: "conversation.reply",
          status: "FAILED", provider_reference: null },
      ],
    });
    const outcome = await readOperationalDeliveryTriage("service-desk", h.deps);
    expect(outcome).toMatchObject({ ok: true, value: {
      scannedOutboundMessages: 2,
      counts: { ok: 0, pending: 0, review: 2 },
      items: [
        { messageId: "msg1", deliveryState: "PROVIDER_ACCEPTED" },
        { messageId: "msg2", deliveryState: "FAILED" },
      ],
    } });
    expect(h.inclusions).toContainEqual({
      table: "outbox_events", column: "id", ids: ["outbox1", "outbox2"],
    });
  });

  it("rejects unrelated outbox topic receipts even in the same workspace", async () => {
    for (const topic of ["payment.received", "booking.confirmed", "workflow.action"]) {
      const h = fixture({ rows: [{ ...outbound[0], outbox_event_id: "outbox1" }],
        outbox: [{ id: "outbox1", workspace_id: "ws1",
          topic, status: "SENT", provider_reference: "unrelated-success" }],
      });
      expect(await readOperationalDeliveryTriage("service-desk", h.deps)).toMatchObject({
        ok: false, code: "DELIVERY_TRIAGE_OUTBOX_INVALID",
      });
    }
    const valid = fixture({ rows: [{ ...outbound[0], outbox_event_id: "outbox1" }],
      outbox: [{ id: "outbox1", workspace_id: "ws1",
        topic: "conversation.reply", status: "SENT", provider_reference: "approved-send" }],
    });
    expect(await readOperationalDeliveryTriage("service-desk", valid.deps)).toMatchObject({
      ok: true, value: { items: [
        { messageId: "msg1", deliveryState: "PROVIDER_ACCEPTED",
          evidenceSource: "OUTBOX_PROVIDER_ACCEPTANCE" },
      ] },
    });
  });

  it("fails closed on send timestamps far ahead of verified reporting time",async()=>{
    const current="2026-10-11T06:00:00Z";
    for(const future of [
      "2026-10-11T06:05:01Z",
      "2026-10-11T06:15:00Z",
      "2036-10-11T05:59:00Z",
    ]) {
      const h=fixture({rows:[{...outbound[0],created_at:future,
        delivery_state:"PROVIDER_ACCEPTED"}]});
      expect(await readOperationalDeliveryTriage("service-desk",h.deps))
        .toMatchObject({ok:false,code:"DELIVERY_TRIAGE_MESSAGE_SCOPE_INVALID"});
      // Do not continue querying customer conversations or outbox receipts.
      expect(h.seen).toEqual(["messages"]);
    }
    const tolerated=fixture({rows:[{...outbound[0],
      created_at:"2026-10-11T06:04:59Z"}]});
    const result=await readOperationalDeliveryTriage("service-desk",tolerated.deps);
    expect(result).toMatchObject({ok:true,value:{
      items:[{ageMinutes:0,health:"PENDING"}],
    }});
    expect(current).toBe("2026-10-11T06:00:00Z");
  });
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
