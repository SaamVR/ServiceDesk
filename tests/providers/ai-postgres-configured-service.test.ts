import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/contracts";
import { ApprovedKnowledgeIndex } from "../../src/server/ai/knowledge";
import { createPostgresConfiguredAiService } from "../../src/server/ai/postgres-configured-service";
import type { AiPersistedMessageLookup, PersistedHumanMessage } from "../../src/server/ai/postgres-conversation-store";

const actor = { role: "DISPATCHER", userId: "user-1", workspaceId: "tenant-1" } as ActorContext;
const event = {
  messageId: "message-1", channel: "WHATSAPP" as const,
  receivedAt: "2026-10-11T03:10:00Z", text: "I need a deep cleaning quote.",
  requestId: "request-1",
};
const row: PersistedHumanMessage = {
  id: "message-1", workspace_id: "tenant-1",
  conversation_id: "conversation-1", direction: "INBOUND",
  sender_kind: "CUSTOMER", body: event.text,
};
function lookup(record: PersistedHumanMessage | null) {
  const query = {
    eq() { return this; },
    async maybeSingle() { return { data: record, error: null }; },
  };
  return {
    from: () => ({ select: () => query }),
  } as unknown as AiPersistedMessageLookup;
}
function configured(record: PersistedHumanMessage | null) {
  let requests = 0;
  const service = createPostgresConfiguredAiService(lookup(record), {
    knowledge: new ApprovedKnowledgeIndex([]),
    promptVersion: "v3-production-boundary",
    modelConfig: {
      apiBaseUrl: "https://api.openai.com/v1",
      apiKey: "synthetic-no-provider-send",
      model: "synthetic-model",
      now: () => "2026-10-11T03:10:00Z",
    },
    http: async () => {
      requests++;
      return { status: 200, body: JSON.stringify({
        object: "response", status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
          output: { corrections: [], unsupportedReasons: [], riskFlags: [] },
          replyDraft: "Your request can be reviewed by our dispatcher.",
          requestedToolCalls: [{ name: "getServiceCatalog", arguments: {} }],
        }) }] }],
      }) };
    },
  });
  return { service, getCalls: () => requests };
}

describe("configured AI with authoritative persisted customer messages", () => {
  it("processes a verified tenant-scoped inbound message as a non-executing proposal", async () => {
    const { service, getCalls } = configured(row);
    const result = await service.respond(actor, "conversation-1", event);
    expect(result).toMatchObject({ ok: true, value: {
      savedHumanMessageId: row.id, handoverRequired: false,
      privateReasoningStored: false,
      toolCalls: [{ name: "getServiceCatalog", executionBoundary: "SERVICE_DESK_FACADE_ONLY" }],
    } });
    expect(getCalls()).toBe(1);
  });

  it("does not call the model for unsaved or foreign workspace messages", async () => {
    for (const invalid of [null, { ...row, workspace_id: "foreign-tenant" },
      { ...row, sender_kind: "STAFF" }, { ...row, conversation_id: "other" }]) {
      const { service, getCalls } = configured(invalid);
      const result = await service.respond(actor, "conversation-1", event);
      expect(result).toMatchObject({ ok: false, code: "AI_MESSAGE_PERSISTENCE_FAILED" });
      expect(getCalls()).toBe(0);
      expect(JSON.stringify(result)).not.toContain(event.text);
    }
  });

  it("refuses visitor, customer, crew or identity-free actors before message lookup", async () => {
    const { service, getCalls } = configured(row);
    for (const role of ["VISITOR", "CUSTOMER", "CREW", "PLATFORM_OPERATOR", "OWNER"] as const) {
      const ctx = { ...actor, role, userId: role === "OWNER" ? "" : "some-id" } as ActorContext;
      expect(await service.respond(ctx, "conversation-1", event))
        .toMatchObject({ ok: false, code: "AI_STAFF_AUTH_REQUIRED" });
    }
    expect(getCalls()).toBe(0);
  });
});
