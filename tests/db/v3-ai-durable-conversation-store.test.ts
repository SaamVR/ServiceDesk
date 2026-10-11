import { describe, expect, it } from "vitest";
import {
  createPostgresVerifiedAiConversationStore,
  type AiPersistedMessageLookup,
  type PersistedHumanMessage,
} from "../../src/server/ai/postgres-conversation-store";

const stored: PersistedHumanMessage = {
  id: "message-1",
  workspace_id: "workspace-1",
  conversation_id: "conversation-1",
  direction: "INBOUND",
  sender_kind: "CUSTOMER",
  body: "Please book a deep clean.",
};
const input = {
  workspaceId: stored.workspace_id,
  conversationId: stored.conversation_id,
  messageId: stored.id,
  text: stored.body!,
  receivedAt: "2026-10-11T03:00:00.000Z",
};

function gateway(row: PersistedHumanMessage | null, fault?: "THROW" | "ERROR") {
  const filters: Array<[string, string]> = [];
  const columns: string[] = [];
  const query = {
    eq(key: string, value: string) {
      filters.push([key, value] as const);
      return this;
    },
    async maybeSingle() {
      if (fault === "THROW") throw new Error("Bearer sensitive-secret customer@example.test");
      if (fault === "ERROR") {
        return { data: null, error: { message: "secret SQL customer@example.test" } };
      }
      return { data: row, error: null };
    },
  };
  const client: AiPersistedMessageLookup = {
    from(name: "messages") {
      expect(name).toBe("messages");
      return {
        select(fields: string) {
          columns.push(fields);
          return query;
        },
      };
    },
  };
  return { client, filters, columns };
}

describe("AI stored-human-message authority", () => {
  it("only confirms an existing exact tenant, conversation and human message", async () => {
    const { client, filters, columns } = gateway(stored);
    const store = createPostgresVerifiedAiConversationStore(client);
    await expect(store.appendHumanMessage(input)).resolves.toBe("message-1");
    expect(filters).toEqual([
      ["workspace_id", "workspace-1"],
      ["conversation_id", "conversation-1"],
      ["id", "message-1"],
    ]);
    expect(columns).toEqual(["id,workspace_id,conversation_id,direction,sender_kind,body"]);
  });

  it("rejects foreign tenant, conversation, row identity and staff/outbound messages", async () => {
    const cases = [
      { ...stored, workspace_id: "foreign-workspace" },
      { ...stored, conversation_id: "foreign-conversation" },
      { ...stored, id: "foreign-message" },
      { ...stored, direction: "OUTBOUND" },
      { ...stored, sender_kind: "STAFF" },
      { ...stored, body: "a different customer message" },
      { ...stored, body: null },
      null,
    ];
    for (const row of cases) {
      const store = createPostgresVerifiedAiConversationStore(gateway(row).client);
      await expect(store.appendHumanMessage(input)).rejects.toThrow("AI_PERSISTED_MESSAGE_SCOPE_MISMATCH");
    }
  });

  it("cannot trigger a database lookup with missing message identifiers or invalid timestamps", async () => {
    let calls = 0;
    const client: AiPersistedMessageLookup = {
      from: () => {
        calls++;
        return gateway(stored).client.from("messages");
      },
    };
    const store = createPostgresVerifiedAiConversationStore(client);
    for (const value of [
      { ...input, workspaceId: " " },
      { ...input, conversationId: "" },
      { ...input, messageId: " " },
      { ...input, text: "" },
      { ...input, receivedAt: "invalid-timestamp" },
    ]) {
      await expect(store.appendHumanMessage(value)).rejects.toThrow("AI_PERSISTED_MESSAGE_IDENTITY_INVALID");
    }
    expect(calls).toBe(0);
  });

  it("redacts database errors and exceptions rather than leaking provider PII or credentials", async () => {
    for (const kind of ["ERROR", "THROW"] as const) {
      const store = createPostgresVerifiedAiConversationStore(gateway(stored, kind).client);
      await expect(store.appendHumanMessage(input))
        .rejects.toThrow("AI_PERSISTED_MESSAGE_READ_FAILED");
      try {
        await store.appendHumanMessage(input);
      } catch (error) {
        expect(String(error)).not.toContain("sensitive-secret");
        expect(String(error)).not.toContain("customer@example.test");
      }
    }
  });

  it("accepts leading/trailing whitespace normalization from an authoritative inbound RPC", async () => {
    const store = createPostgresVerifiedAiConversationStore(
      gateway({ ...stored, body: "  Please book a deep clean.  " }).client);
    await expect(store.appendHumanMessage(input)).resolves.toBe(stored.id);
  });
});
