import type { ActorContext, ConversationDTO, MessageDTO, Result, WorkspaceSnapshot } from "../../contracts";
import type {
  ConversationHandoverInput,
  ConversationReplyInput,
  ConversationReplyOutcome,
  InboundMessageApplicationOutcome,
  InboundMessageEvent,
  ServiceDeskFacade,
  WorkspaceSnapshotQuery,
} from "./facade";
import type { SupabaseRpcClient } from "./payment-application-postgres";

function asResult<T>(data: Record<string, unknown> | null, error: { message: string; code?: string } | null, fallbackCode: string, value: (row: Record<string, unknown>) => T): Result<T> {
  if (error) return { ok: false, code: error.code ?? fallbackCode, message: error.message };
  if (!data || data.ok === false) return { ok: false, code: String(data?.code ?? fallbackCode), message: "Conversation command was rejected by the database RPC." };
  return { ok: true, value: value(data) };
}

function conversationFromRpc(row: Record<string, unknown>): ConversationDTO {
  return {
    id: String(row.id ?? row.conversationId),
    workspaceId: String(row.workspaceId),
    requestId: row.requestId ? String(row.requestId) : undefined,
    customerId: row.customerId ? String(row.customerId) : undefined,
    channel: String(row.channel ?? "WHATSAPP") as ConversationDTO["channel"],
    assignedUserId: row.assignedUserId ? String(row.assignedUserId) : undefined,
    handoverActive: Boolean(row.handoverActive),
    version: Number(row.version ?? row.conversationVersion ?? 0),
    lastMessageAt: row.lastMessageAt ? String(row.lastMessageAt) : undefined,
  };
}

function messageFromRpc(row: Record<string, unknown>): MessageDTO {
  return {
    id: String(row.id ?? row.messageId),
    workspaceId: String(row.workspaceId),
    conversationId: String(row.conversationId),
    direction: String(row.direction ?? "OUTBOUND") as MessageDTO["direction"],
    senderKind: String(row.senderKind ?? "STAFF") as MessageDTO["senderKind"],
    providerMessageId: row.providerMessageId ? String(row.providerMessageId) : undefined,
    body: row.body ? String(row.body) : undefined,
    mediaReference: row.mediaReference as MessageDTO["mediaReference"],
    deliveryState: row.deliveryState as MessageDTO["deliveryState"],
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
  };
}

export function createPostgresConversationFacadeMethods(client: SupabaseRpcClient): Pick<ServiceDeskFacade, "applyInboundMessage" | "setConversationHandover" | "enqueueConversationReply" | "readWorkspaceSnapshot"> {
  return {
    async applyInboundMessage(event: InboundMessageEvent): Promise<Result<InboundMessageApplicationOutcome>> {
      const { data, error } = await client.rpc<Record<string, unknown>>("servicedesk_apply_inbound_message", { p_event: event });
      return asResult(data, error, "INBOUND_RPC_ERROR", (row) => ({
        state: String(row.state) as InboundMessageApplicationOutcome["state"],
        conversation: conversationFromRpc(row),
        message: row.messageId ? messageFromRpc(row) : undefined,
      }));
    },
    async setConversationHandover(ctx: ActorContext, id: string, input: ConversationHandoverInput, meta): Promise<Result<ConversationDTO>> {
      const { data, error } = await client.rpc<Record<string, unknown>>("servicedesk_set_conversation_handover", {
        p_input: { workspaceId: ctx.workspaceId, actorRole: ctx.role, actorUserId: ctx.userId, conversationId: id, expectedVersion: meta.expectedVersion, ...input },
      });
      return asResult(data, error, "HANDOVER_RPC_ERROR", conversationFromRpc);
    },
    async enqueueConversationReply(ctx: ActorContext, id: string, input: ConversationReplyInput, meta): Promise<Result<ConversationReplyOutcome>> {
      const { data, error } = await client.rpc<Record<string, unknown>>("servicedesk_enqueue_conversation_reply", {
        p_input: { workspaceId: ctx.workspaceId, actorRole: ctx.role, actorUserId: ctx.userId, conversationId: id, expectedVersion: meta.expectedVersion, idempotencyKey: meta.idempotencyKey, ...input },
      });
      return asResult(data, error, "REPLY_RPC_ERROR", (row) => ({
        message: messageFromRpc(row),
        outboxEventId: String(row.outboxEventId),
      }));
    },
    async readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery): Promise<Result<WorkspaceSnapshot>> {
      const { data, error } = await client.rpc<Record<string, unknown>>("servicedesk_read_workspace_snapshot", {
        p_input: { workspaceId: ctx.workspaceId, actorRole: ctx.role, actorUserId: ctx.userId, ...query },
      });
      return asResult(data, error, "SNAPSHOT_RPC_ERROR", (row) => ({
        requests: [], quotes: [], visits: [], invoices: [],
        conversations: ((row.conversations as Record<string, unknown>[] | undefined) ?? []).map(conversationFromRpc),
        messages: ((row.messages as Record<string, unknown>[] | undefined) ?? []).map(messageFromRpc),
      }));
    },
  };
}
