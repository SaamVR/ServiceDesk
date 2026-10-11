import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/contracts";
import { createConfiguredAiService } from "../../src/server/ai/configured-service";
import { ApprovedKnowledgeIndex } from "../../src/server/ai/knowledge";
import type { AiModelHttpTransport } from "../../src/server/ai/model-transport";
import type { AiConversationStore, AiMessageInput } from "../../src/server/ai/types";

const ctx = { workspaceId: "ws-a", userId: "owner-a", role: "OWNER" } as ActorContext;
const input: AiMessageInput = {
  messageId: "message-1", channel: "WEB", text: "I need move-out cleaning.",
  receivedAt: "2026-10-11T03:00:00Z", requestId: "request-1", customerId: "customer-1",
};
const approved = { documentId: "faq-a", title: "Move out FAQ", version: 3, chunkId: "prep-a" };
const knowledge = new ApprovedKnowledgeIndex([
  { ...approved, workspaceId: "ws-a", approved: true, text: "Move-out cleaning requires a staff-reviewed quotation." },
  { documentId: "draft-b", workspaceId: "ws-a", title: "Forbidden draft", version: 1,
    chunkId: "draft-b", approved: false, text: "Move-out draft must never be cited." },
  { documentId: "foreign-c", workspaceId: "ws-b", title: "Another business", version: 1,
    chunkId: "foreign-c", approved: true, text: "Move-out pricing for another tenant." },
]);
function harness(http: AiModelHttpTransport) {
  const saved: unknown[] = [];
  const store: AiConversationStore = { async appendHumanMessage(event) {
    saved.push(event); return event.messageId;
  } };
  return {
    saved,
    service: createConfiguredAiService({
      store, knowledge, http, promptVersion: "controlled-v3",
      modelConfig: {
        apiBaseUrl: "https://api.openai.com/v1",
        apiKey: "synthetic-test-key-not-live",
        model: "controlled-model",
        now: () => "2026-10-11T03:00:00Z",
      },
    }),
  };
}
function response(options: {
  replyDraft?: string;
  citations?: unknown[];
  requestedToolCalls?: unknown[];
  output?: Record<string, unknown>;
} = {}): string {
  return JSON.stringify({
    object: "response", status: "completed",
    output: [{
      type: "message", content: [{ type: "output_text", text: JSON.stringify({
        output: options.output ?? { serviceCode: "MOVE_OUT", corrections: [], unsupportedReasons: [], riskFlags: [] },
        replyDraft: options.replyDraft ?? "A dispatcher can prepare your move-out quote.",
        citations: options.citations ?? [approved],
        requestedToolCalls: options.requestedToolCalls ?? [{ name: "calculateQuote", arguments: { requestId: "request-1" } }],
      }) }],
    }],
  });
}
describe("configured AI service real business proposal orchestration", () => {
  it("persists human input, sends approved workspace knowledge, and returns facade-only model proposals", async () => {
    const requests: string[] = [];
    const { saved, service } = harness(async request => {
      requests.push(request.body);
      return { status: 200, body: response() };
    });
    const result = await service.respond(ctx, "conversation-a", input);
    expect(result).toMatchObject({ ok: true, value: {
      savedHumanMessageId: "message-1",
      conversationId: "conversation-a",
      workspaceId: "ws-a",
      handoverRequired: false,
      citations: [approved],
      extraction: { serviceCode: "MOVE_OUT" },
      toolCalls: [{ name: "calculateQuote", allowed: true }],
      privateReasoningStored: false,
    } });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ workspaceId: "ws-a", messageId: "message-1" });
    const body = JSON.parse(requests[0]);
    expect(body.store).toBe(false);
    expect(body.input[1].content).toContain("faq-a");
    expect(body.input[1].content).not.toMatch(/foreign-c|draft-b|another tenant/i);
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("synthetic-test-key-not-live");
  });

  it("does not call the model while a human handover is active", async () => {
    let calls = 0;
    const { service, saved } = harness(async () => {
      calls++; return { status: 200, body: response() };
    });
    const result = await service.respond(ctx, "conversation-a", { ...input, handoverActive: true });
    expect(result).toMatchObject({ ok: true, value: {
      handoverRequired: true, handoverReason: "HUMAN_HANDOVER_ACTIVE",
      toolCalls: [{ name: "requestHumanReview" }],
    } });
    expect(saved).toHaveLength(1);
    expect(calls).toBe(0);
  });

  it("routes cross-request model tools to operator review instead of executing them", async () => {
    const { service } = harness(async () => ({
      status: 200, body: response({
        requestedToolCalls: [{ name: "calculateQuote", arguments: { requestId: "someone-elses-request" } }],
      }),
    }));
    const result = await service.respond(ctx, "conversation-a", input);
    expect(result).toMatchObject({ ok: true, value: {
      handoverRequired: true, handoverReason: "AI_TOOL_SCOPE_REJECTED",
      toolCalls: [{ name: "requestHumanReview" }],
    } });
    expect(JSON.stringify(result)).not.toContain("someone-elses-request");
  });

  it("rejects forged/unapproved citations and model-authored payment truth", async () => {
    for (const raw of [
      response({ citations: [{ ...approved, documentId: "foreign-c" }] }),
      response({ output: { paymentStatus: "PAID", corrections: [], unsupportedReasons: [], riskFlags: [] } }),
      response({ citations: [] }),
    ]) {
      const { service } = harness(async () => ({ status: 200, body: raw }));
      const result = await service.respond(ctx, "conversation-a", input);
      expect(result).toMatchObject({ ok: true, value: {
        handoverRequired: true,
        toolCalls: [{ name: "requestHumanReview" }],
        citations: [],
      } });
    }
  });

  it("falls back safely after malformed HTTP model response; it never leaks provider errors", async () => {
    const { service, saved } = harness(async () => ({ status: 200, body: "null" }));
    const result = await service.respond(ctx, "conversation-a", input);
    expect(result).toMatchObject({ ok: true, value: {
      handoverRequired: true, handoverReason: "AI_PROVIDER_OR_OUTPUT_UNAVAILABLE",
    } });
    expect(saved).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(input.text);
  });

  it("fails input or persistence before attempting a provider call", async () => {
    let calls = 0;
    const { service } = harness(async () => { calls++; return { status: 200, body: response() }; });
    expect(await service.respond(ctx, "conversation-a", { ...input, text: " " }))
      .toMatchObject({ ok: false, code: "AI_MESSAGE_INVALID" });
    expect(await service.respond(ctx, "conversation-a", { ...input, text: "x".repeat(8_001) }))
      .toMatchObject({ ok: false, code: "AI_MESSAGE_INVALID" });
    const failing = createConfiguredAiService({
      knowledge, http: async () => { calls++; throw new Error("must not reach"); },
      modelConfig: { apiBaseUrl: "https://api.openai.com/v1", apiKey: "synthetic",
        model: "controlled", now: () => "2026-10-11T03:00:00Z" },
      promptVersion: "controlled",
      store: { async appendHumanMessage() { throw new Error("Bearer sensitive-customer-secret"); } },
    });
    const result = await failing.respond(ctx, "conversation-a", input);
    expect(result).toMatchObject({ ok: false, code: "AI_MESSAGE_PERSISTENCE_FAILED" });
    expect(JSON.stringify(result)).not.toContain("sensitive-customer-secret");
    expect(calls).toBe(0);
  });
});
