import type { AiConversationStore } from "./types";

export interface PersistedHumanMessage {
  id: string;
  workspace_id: string;
  conversation_id: string;
  direction: string;
  sender_kind: string;
  body: string | null;
}

export interface AiPersistedMessageLookup {
  from(table: "messages"): {
    select(columns: string): {
      eq(column: string, value: string): AiPersistedMessageQuery;
    };
  };
}

export interface AiPersistedMessageQuery {
  eq(column: string, value: string): AiPersistedMessageQuery;
  maybeSingle(): Promise<{
    data: PersistedHumanMessage | null;
    error: { message?: string; code?: string } | null;
  }>;
}

/**
 * This implementation deliberately DOES NOT create another message.
 *
 * The authoritative email/WhatsApp Core inbound RPC already atomically
 * persists a message, indexes the provider receipt, and links its conversation.
 * AI may only run *after* that RPC commits. Re-inserting here could create a
 * second customer message, split identity, or bypass idempotent receipt checks.
 *
 * appendHumanMessage preserves the existing AiConversationStore interface,
 * but is an explicit read-after-write persistence verification boundary.
 */
export function createPostgresVerifiedAiConversationStore(
  client: AiPersistedMessageLookup,
): AiConversationStore {
  return {
    async appendHumanMessage(input): Promise<string> {
      const { workspaceId, conversationId, messageId, text, receivedAt } = input;
      if (![workspaceId, conversationId, messageId, text].every(
        value => typeof value === "string" && value.trim().length > 0,
      ) || !Number.isFinite(Date.parse(receivedAt))) {
        throw new Error("AI_PERSISTED_MESSAGE_IDENTITY_INVALID");
      }

      let found: PersistedHumanMessage | null;
      try {
        const { data, error } = await client
          .from("messages")
          .select("id,workspace_id,conversation_id,direction,sender_kind,body")
          .eq("workspace_id", workspaceId)
          .eq("conversation_id", conversationId)
          .eq("id", messageId)
          .maybeSingle();
        if (error) throw new Error("AI_PERSISTED_MESSAGE_READ_FAILED");
        found = data;
      } catch {
        // A DB exception might contain access tokens, SQL details, or PII.
        throw new Error("AI_PERSISTED_MESSAGE_READ_FAILED");
      }

      if (!found || found.id !== messageId ||
          found.workspace_id !== workspaceId ||
          found.conversation_id !== conversationId ||
          found.direction !== "INBOUND" ||
          found.sender_kind !== "CUSTOMER" ||
          typeof found.body !== "string" ||
          found.body.trim() !== text.trim()) {
        throw new Error("AI_PERSISTED_MESSAGE_SCOPE_MISMATCH");
      }
      return found.id;
    },
  };
}
