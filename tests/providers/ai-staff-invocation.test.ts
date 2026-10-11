import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/contracts";
import { executeAuthorizedStaffAiTurn } from "../../src/server/ai/staff-invocation";
import type { ResolvedStaffActor } from "../../src/features/operations/operational-product-runtime";

const actor: ActorContext = { userId: "user-1", role: "OWNER", workspaceId: "ws-1" };
const conversation = { id: "conv-1", workspace_id: "ws-1", request_id: "req-1",
  customer_id: "customer-1", handover_active: false };
const message = { id: "msg-1", workspace_id: "ws-1", conversation_id: "conv-1",
  direction: "INBOUND", sender_kind: "CUSTOMER", body: "Can I book a deep cleaning?",
  created_at: "2026-10-11T03:00:00.000Z" };
const request = { id: "req-1", workspace_id: "ws-1", branch_id: "branch-1" };
const input = { workspaceSlug: "service-desk", conversationId: "conv-1", messageId: "msg-1" };
const env = { SERVICEDESK_AI_ENABLED: "true", OPENAI_API_KEY: "synthetic-key-only",
  SERVICEDESK_AI_MODEL: "controlled-model" };
const reply = JSON.stringify({ object: "response", status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
    output: { corrections: [], unsupportedReasons: [], riskFlags: [] },
    replyDraft: "A dispatcher can review the deep-cleaning request.",
    requestedToolCalls: [{ name: "getServiceCatalog", arguments: {} }],
  }) }] }] });

function fixture(config: {
  who?: ActorContext; branch?: string; handover?: boolean;
  conversation?: Record<string, unknown> | null;
  message?: Record<string, unknown> | null;
  request?: Record<string, unknown> | null;
  authFailed?: boolean;
} = {}) {
  const lookups: string[] = [];
  let network = 0;
  const read = (table: string) => {
    const filters: Array<[string, string]> = [];
    const api = {
      eq(key: string, value: string) { filters.push([key, value]); return api; },
      async maybeSingle() {
        lookups.push(table);
        const raw = table === "conversations" ?
          (config.conversation === undefined ? { ...conversation, handover_active: Boolean(config.handover) } : config.conversation) :
          table === "messages" ? (config.message === undefined ? message : config.message) :
          table === "requests" ? (config.request === undefined ? request : config.request) : null;
        if (raw && filters.some(([k, v]) => raw[k] !== v)) return { data: null, error: null };
        return { data: raw, error: null };
      },
    };
    return { select: () => api };
  };
  const staff = {
    workspace: { id: "ws-1", slug: "service-desk", name: "Service Desk", timezone: "UTC", currency: "USD" },
    actor: config.who ?? actor,
    service: { from: read },
    rpc: {},
    branchScope: config.branch ? { mode: "BRANCH", selectedBranchId: config.branch, branches: [] }
      : { mode: "ALL", branches: [] },
  } as unknown as ResolvedStaffActor;
  const opts = {
    resolveActor: async () => config.authFailed
      ? { ok: false as const, kind: "authentication", message: "Sign in required" }
      : { ok: true as const, value: staff },
    env, promptVersion: "controlled-v3-inbox",
    fetchPort: async () => { network++; return new Response(reply, { status: 200 }); },
  };
  return { opts, calls: () => ({ network, lookups }) };
}
describe("staff authenticated operational AI invocation", () => {
  it("uses only a verified workspace session and a real saved customer message", async () => {
    const data = fixture();
    const result = await executeAuthorizedStaffAiTurn(input, data.opts);
    expect(result).toMatchObject({ ok: true, value: {
      handoverRequired: false, workspaceId: "ws-1", savedHumanMessageId: "msg-1",
      toolCalls: [{ name: "getServiceCatalog", executionBoundary: "SERVICE_DESK_FACADE_ONLY" }],
    } });
    expect(data.calls().network).toBe(1);
    expect(data.calls().lookups).toEqual(["conversations", "messages", "messages"]);
    expect(JSON.stringify(result)).not.toContain("synthetic-key-only");
  });

  it("requires membership authority, not a client-supplied staff role", async () => {
    for (const data of [
      fixture({ authFailed: true }),
      fixture({ who: { ...actor, role: "CUSTOMER" } }),
      fixture({ who: { ...actor, workspaceId: "other" } }),
    ]) {
      const result = await executeAuthorizedStaffAiTurn(input, data.opts);
      expect(result.ok).toBe(false);
      expect(data.calls().network).toBe(0);
      expect(data.calls().lookups).toEqual([]);
    }
  });

  it("prevents dispatchers from crossing assigned branches or unassigned requests", async () => {
    const dispatcher: ActorContext = { ...actor, role: "DISPATCHER" };
    for (const config of [
      { who: dispatcher, branch: "different-branch" },
      { who: dispatcher, branch: "branch-1", conversation: { ...conversation, request_id: null } },
    ]) {
      const data = fixture(config);
      expect(await executeAuthorizedStaffAiTurn(input, data.opts))
        .toMatchObject({ ok: false, code: "AI_BRANCH_SCOPE_REQUIRED" });
      expect(data.calls().network).toBe(0);
    }
    const allowed = fixture({ who: dispatcher, branch: "branch-1" });
    expect((await executeAuthorizedStaffAiTurn(input, allowed.opts)).ok).toBe(true);
    expect(allowed.calls().network).toBe(1);
  });

  it("does not generate drafts for outbound, cross-tenant, missing or oversized messages", async () => {
    for (const changed of [
      null,
      { ...message, direction: "OUTBOUND" },
      { ...message, sender_kind: "STAFF" },
      { ...message, workspace_id: "ws-other" },
      { ...message, body: "x".repeat(8_001) },
    ]) {
      const data = fixture({ message: changed });
      expect((await executeAuthorizedStaffAiTurn(input, data.opts)).ok).toBe(false);
      expect(data.calls().network).toBe(0);
    }
  });

  it("never calls the model on active human handover", async () => {
    const data = fixture({ handover: true });
    const result = await executeAuthorizedStaffAiTurn(input, data.opts);
    expect(result).toMatchObject({ ok: true, value: {
      handoverRequired: true, handoverReason: "HUMAN_HANDOVER_ACTIVE",
    } });
    expect(data.calls().network).toBe(0);
  });

  it("feature-disabled runtime exits before private database reads", async () => {
    const data = fixture();
    const result = await executeAuthorizedStaffAiTurn(input, {
      ...data.opts, env: { ...env, SERVICEDESK_AI_ENABLED: "false" },
    });
    expect(result).toMatchObject({ ok: false, code: "AI_RUNTIME_DISABLED" });
    expect(data.calls().lookups).toEqual([]);
  });

  it("rejects malformed identifiers without invoking the privileged actor resolver", async () => {
    let calls = 0;
    const data = fixture();
    const result = await executeAuthorizedStaffAiTurn({ ...input, workspaceSlug: "../other" }, {
      ...data.opts, resolveActor: async (slug) => { calls++; return data.opts.resolveActor(slug); },
    });
    expect(result).toMatchObject({ ok: false, code: "AI_STAFF_INPUT_INVALID" });
    expect(calls).toBe(0);
  });
});
