import type { ActorContext, CommandMeta, ConversationDTO, Result } from "@/contracts";
import type {
  ConversationHandoverInput,
  ConversationReplyInput,
  ConversationReplyOutcome,
  WorkspaceSnapshot,
  WorkspaceSnapshotQuery,
} from "@/server/core/facade";
import {
  productActionFailure,
  productActionSuccess,
  type ProductActionError,
  type ProductActionResult,
  type ProductCommandResult,
} from "@/features/operations/server-action-adapters";
import type { InboxSnapshot } from "@/features/operations/route-data";

export type {
  ConversationHandoverInput,
  ConversationReplyInput,
  ConversationReplyOutcome,
  WorkspaceSnapshot,
  WorkspaceSnapshotQuery,
};

export interface InboxCommandPort {
  readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery): Promise<Result<WorkspaceSnapshot>>;
  setConversationHandover(
    ctx: ActorContext,
    conversationId: string,
    input: ConversationHandoverInput,
    meta: CommandMeta,
  ): Promise<Result<ConversationDTO>>;
  enqueueConversationReply(
    ctx: ActorContext,
    conversationId: string,
    input: ConversationReplyInput,
    meta: CommandMeta,
  ): Promise<Result<ConversationReplyOutcome>>;
}

export interface LoadInboxInput {
  ctx: ActorContext;
  query: WorkspaceSnapshotQuery;
  selectedConversationId: string;
}

export interface ToggleHandoverInput {
  ctx: ActorContext;
  conversation: ConversationDTO;
  active: boolean;
  assignedUserId?: string;
  meta: Omit<CommandMeta, "expectedVersion">;
}

export interface ReplyInput {
  ctx: ActorContext;
  conversation: ConversationDTO;
  body: string;
  channel: ConversationReplyInput["channel"];
  meta: Omit<CommandMeta, "expectedVersion">;
}

function boundaryError(code: string, message: string): ProductActionError {
  return { code, message };
}

function commandFailure<T>(code: string, message: string): ProductCommandResult<T> {
  return { ok: false, error: boundaryError(code, message) };
}

function resultFailure<T>(result: Extract<Result<T>, { ok: false }>): ProductActionError {
  return { code: result.code, message: result.message };
}

function isCoreSuccess<T>(result: Result<T>): result is Extract<Result<T>, { ok: true }> {
  return result.ok === true;
}

export function buildInboxSnapshotFromWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  selectedConversationId: string,
  actorWorkspaceId: string,
): ProductCommandResult<InboxSnapshot> {
  const crossWorkspaceConversation = snapshot.conversations.find((item) => item.workspaceId !== actorWorkspaceId);
  if (crossWorkspaceConversation) {
    return commandFailure("CONVERSATION_WORKSPACE_MISMATCH", "Workspace snapshot contains a conversation from a different workspace.");
  }

  const crossWorkspaceMessage = snapshot.messages.find((item) => item.workspaceId !== actorWorkspaceId);
  if (crossWorkspaceMessage) {
    return commandFailure("MESSAGE_WORKSPACE_MISMATCH", "Workspace snapshot contains a message from a different workspace.");
  }

  const conversation = snapshot.conversations.find((item) => item.id === selectedConversationId);
  if (!conversation) {
    return commandFailure("CONVERSATION_NOT_FOUND", "Selected conversation is not present in the workspace snapshot.");
  }
  if (conversation.workspaceId !== actorWorkspaceId) {
    return commandFailure("CONVERSATION_WORKSPACE_MISMATCH", "Selected conversation belongs to a different workspace.");
  }

  const messages = snapshot.messages.filter((message) => message.conversationId === conversation.id);
  const malformedSelectedMessage = messages.find((message) => message.conversationId !== conversation.id);
  if (malformedSelectedMessage) {
    return commandFailure("MESSAGE_CONVERSATION_MISMATCH", "Selected conversation messages must match the selected conversation.");
  }

  const request = conversation.requestId ? snapshot.requests.find((item) => item.id === conversation.requestId) : undefined;
  if (request && request.workspaceId !== actorWorkspaceId) {
    return commandFailure("REQUEST_WORKSPACE_MISMATCH", "Selected conversation request belongs to a different workspace.");
  }

  return {
    ok: true,
    value: {
      conversation,
      messages,
      customerLabel: conversation.customerId ? `Customer ${conversation.customerId}` : "Unknown customer",
      requestLabel: request ? `${request.serviceCode ?? "REQUEST"} · ${request.status}` : conversation.requestId ?? "No request linked",
      actionAvailability: {
        handoverEnabled: false,
        replyEnabled: false,
        handoverLabel: "Server handover command available after route wiring",
        replyLabel: "Server reply command available after route wiring",
        disabledReason: "Fixture/demo route only; E05 actions are dependency-injected but not bound to this page yet.",
      },
    },
  };
}

export function createInboxServerActionFactory(commands: InboxCommandPort) {
  return {
    async loadInbox(input: LoadInboxInput): Promise<ProductActionResult<InboxSnapshot>> {
      const steps = ["readWorkspaceSnapshot"];
      const snapshot = await commands.readWorkspaceSnapshot(input.ctx, input.query);
      if (!isCoreSuccess(snapshot)) {
        return productActionFailure(resultFailure(snapshot), steps, "readWorkspaceSnapshot");
      }

      steps.push("mapInboxSnapshot");
      const mapped = buildInboxSnapshotFromWorkspaceSnapshot(snapshot.value, input.selectedConversationId, input.ctx.workspaceId);
      return mapped.ok
        ? productActionSuccess(mapped.value, steps, "Inbox snapshot loaded from accepted server read model.")
        : productActionFailure(mapped.error, steps, "mapInboxSnapshot");
    },

    async setHandover(input: ToggleHandoverInput): Promise<ProductActionResult<ConversationDTO>> {
      const steps = ["setConversationHandover"];
      const meta: CommandMeta = { ...input.meta, expectedVersion: input.conversation.version };
      const handoverInput: ConversationHandoverInput = { active: input.active, assignedUserId: input.assignedUserId };
      const result = await commands.setConversationHandover(input.ctx, input.conversation.id, handoverInput, meta);
      return isCoreSuccess(result)
        ? productActionSuccess(result.value, steps, "Conversation handover updated by server command.")
        : productActionFailure(resultFailure(result), steps, "setConversationHandover");
    },

    async enqueueReply(input: ReplyInput): Promise<ProductActionResult<ConversationReplyOutcome>> {
      const steps = ["enqueueConversationReply"];
      const meta: CommandMeta = { ...input.meta, expectedVersion: input.conversation.version };
      const replyInput: ConversationReplyInput = { body: input.body, channel: input.channel };
      const result = await commands.enqueueConversationReply(input.ctx, input.conversation.id, replyInput, meta);
      return isCoreSuccess(result)
        ? productActionSuccess(result.value, steps, "Reply was accepted by the server outbound queue.")
        : productActionFailure(resultFailure(result), steps, "enqueueConversationReply");
    },
  };
}
