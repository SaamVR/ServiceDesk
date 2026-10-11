import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/contracts";
import { ApprovedKnowledgeIndex } from "../../src/server/ai/knowledge";
import { createOperationalAiRuntime } from "../../src/server/ai/operational-runtime";
import type { AiPersistedMessageLookup, PersistedHumanMessage } from "../../src/server/ai/postgres-conversation-store";

const actor = { role: "OWNER", userId: "user-1", workspaceId: "ws-1" } as ActorContext;
const message = {
  messageId: "msg-1", text: "I need cleaning.", channel: "WHATSAPP" as const,
  receivedAt: "2026-10-11T03:00:00Z",
};
const saved: PersistedHumanMessage = {
  id: "msg-1", workspace_id: "ws-1", conversation_id: "conv-1",
  direction: "INBOUND", sender_kind: "CUSTOMER", body: message.text,
};
const env = {
  SERVICEDESK_AI_ENABLED: "true",
  OPENAI_API_KEY: "synthetic-only-provider-key",
  SERVICEDESK_AI_MODEL: "gpt-6",
};
function lookup(row: PersistedHumanMessage | null) {
  const q = { eq() { return this; }, async maybeSingle() { return { data: row, error: null }; } };
  return { from: () => ({ select: () => q }) } as unknown as AiPersistedMessageLookup;
}
function officialReply() {
  return JSON.stringify({
    object: "response", status: "completed",
    output: [{ type: "message", content: [{ type: "output_text",
      text: JSON.stringify({ output: { corrections: [], unsupportedReasons: [], riskFlags: [] },
        replyDraft: "We can prepare a quote for staff review.", requestedToolCalls: [] }) }] }],
  });
}
describe("opt-in AI real runtime composition", () => {
  it("assembles only when explicitly enabled and calls the network adapter after persisted message proof", async () => {
    let requests = 0;
    const runtime = createOperationalAiRuntime({
      messages: lookup(saved),
      knowledge: new ApprovedKnowledgeIndex([]),
      promptVersion: "v3-operational-20261011",
      env,
      fetchPort: async (_url, init) => {
        requests++;
        expect(init).toMatchObject({ redirect: "error", cache: "no-store" });
        return new Response(officialReply(), { status: 200 });
      },
    });
    expect(runtime.ok).toBe(true);
    if (!runtime.ok) return;
    expect(requests).toBe(0);
    const result = await runtime.value.respond(actor, "conv-1", message);
    expect(result).toMatchObject({ ok: true, value: {
      handoverRequired: false, savedHumanMessageId: "msg-1",
      replyDraft: "We can prepare a quote for staff review.",
    } });
    expect(requests).toBe(1);
    expect(JSON.stringify(result)).not.toContain("synthetic-only-provider-key");
  });

  it("fails closed when AI is disabled regardless of provider credentials", () => {
    const runtime = createOperationalAiRuntime({
      messages: lookup(saved), knowledge: new ApprovedKnowledgeIndex([]),
      promptVersion: "v3-operational-20261011",
      env: { ...env, SERVICEDESK_AI_ENABLED: "false" },
    });
    expect(runtime).toMatchObject({ ok: false, code: "AI_RUNTIME_DISABLED" });
    expect(JSON.stringify(runtime)).not.toContain(env.OPENAI_API_KEY);
  });

  it("rejects foreign or missing persisted customer message without any provider call", async () => {
    let calls = 0;
    const runtime = createOperationalAiRuntime({
      messages: lookup({ ...saved, workspace_id: "ws-other" }),
      knowledge: new ApprovedKnowledgeIndex([]), env,
      promptVersion: "v3-operational-20261011",
      fetchPort: async () => {
        calls++; return new Response(officialReply());
      },
    });
    if (!runtime.ok) throw new Error("Expected configured runtime");
    expect(await runtime.value.respond(actor, "conv-1", message))
      .toMatchObject({ ok: false, code: "AI_MESSAGE_PERSISTENCE_FAILED" });
    expect(calls).toBe(0);
  });

  it("requires a controlled prompt version and rejects malformed input before provider send", () => {
    for (const promptVersion of ["", " ", "v3 prompt with whitespace", "x".repeat(129)]) {
      const result = createOperationalAiRuntime({
        messages: lookup(saved), knowledge: new ApprovedKnowledgeIndex([]),
        env, promptVersion,
      });
      expect(result).toMatchObject({ ok: false, code: "AI_RUNTIME_PROMPT_VERSION_INVALID" });
    }
  });
});
