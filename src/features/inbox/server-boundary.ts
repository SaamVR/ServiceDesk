import type { ConversationDTO, MessageDTO, RequestDTO } from "@/contracts";
import {
  isCommandSuccess,
  productActionFailure,
  productActionSuccess,
  type ProductActionContext,
  type ProductActionError,
  type ProductActionResult,
  type ProductCommandResult,
} from "@/features/operations/server-action-adapters";
import type { InboxSnapshot } from "@/features/operations/route-data";

export interface WorkspaceSnapshot {
  workspaceId: string;
  conversations: ConversationDTO[];
  messages: MessageDTO[];
  requests?: RequestDTO[];
  customers?: Array<{ id: string; displayName?: string; name?: string; label?: string }>;
}

export interface ReadWorkspaceSnapshotInput {
  context: ProductActionContext;
  workspaceId: string;
}

export interface SetConversationHandoverInput {
  context: ProductActionContext;
  conversationId: string;
  expectedVersion: number;
  handoverActive: boolean;
}

export interface EnqueueConversationReplyInput {
  context: ProductActionContext;
  conversationId: string;
  expectedVersion: number;
  body: string;
}

export interface InboxCommandPort {
  readWorkspaceSnapshot(input: ReadWorkspaceSnapshotInput): Promise<ProductCommandResult<WorkspaceSnapshot>>;
  setConversationHandover(input: SetConversationHandoverInput): Promise<ProductCommandResult<ConversationDTO>>;
  enqueueConversationReply(input: EnqueueConversationReplyInput): Promise<ProductCommandResult<MessageDTO>>;
}

export interface LoadInboxInput {
  context: ProductActionContext;
  workspaceId: string;
  selectedConversationId: string;
}

export interface ToggleHandoverInput {
  context: ProductActionContext;
  conversation: ConversationDTO;
  handoverActive: boolean;
}

export interface ReplyInput {
  context: ProductActionContext;
  conversation: ConversationDTO;
  body: string;
}

function boundaryError(code: string, message: string): ProductActionError {
  return { code, message };
}

function commandFailure<T>(code: string, message: string): ProductCommandResult<T> {
  return { ok: false, error: boundaryError(code, message) };
}

export function buildInboxSnapshotFromWorkspaceSnapshot(snapshot: WorkspaceSnapshot, selectedConversationId: string): ProductCommandResult<InboxSnapshot> {
  const conversation = snapshot.conversations.find((item) => item.id === selectedConversationId);
  if (!conversation) return commandFailure("CONVERSATION_NOT_FOUND", "Selected conversation is not present in the workspace snapshot.");
  if (conversation.workspaceId !== snapshot.workspaceId) return commandFailure("CONVERSATION_WORKSPACE_MISMATCH", "Selected conversation belongs to a different workspace.");

  const messages = snapshot.messages;
  if (messages.some((message) => message.conversationId !== conversation.id)) return commandFailure("MESSAGE_CONVERSATION_MISMATCH", "Snapshot messages must all belong to the selected conversation.");
  if (messages.some((message) => message.workspaceId !== snapshot.workspaceId || message.workspaceId !== conversation.workspaceId)) return commandFailure("MESSAGE_WORKSPACE_MISMATCH", "Snapshot messages must stay inside the selected workspace.");

  const request = conversation.requestId ? snapshot.requests?.find((item) => item.id === conversation.requestId) : undefined;
  const customer = conversation.customerId ? snapshot.customers?.find((item) => item.id === conversation.customerId) : undefined;

  return {
    ok: true,
    value: {
      conversation,
      messages,
      customerLabel: customer?.displayName ?? customer?.name ?? customer?.label ?? conversation.customerId ?? "Unknown customer",
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
      const snapshot = await commands.readWorkspaceSnapshot({ context: input.context, workspaceId: input.workspaceId });
      if (!isCommandSuccess(snapshot)) return productActionFailure(snapshot.error, steps, "readWorkspaceSnapshot");

      steps.push("mapInboxSnapshot");
      const mapped = buildInboxSnapshotFromWorkspaceSnapshot(snapshot.value, input.selectedConversationId);
      return isCommandSuccess(mapped)
        ? productActionSuccess(mapped.value, steps, "Inbox snapshot loaded from accepted server read model.")
        : productActionFailure(mapped.error, steps, "mapInboxSnapshot");
    },

    async setHandover(input: ToggleHandoverInput): Promise<ProductActionResult<ConversationDTO>> {
      const steps = ["setConversationHandover"];
      const result = await commands.setConversationHandover({
        context: input.context,
        conversationId: input.conversation.id,
        expectedVersion: input.conversation.version,
        handoverActive: input.handoverActive,
      });
      return isCommandSuccess(result)
        ? productActionSuccess(result.value, steps, "Conversation handover updated by server command.")
        : productActionFailure(result.error, steps, "setConversationHandover");
    },

    async enqueueReply(input: ReplyInput): Promise<ProductActionResult<MessageDTO>> {
      const steps = ["enqueueConversationReply"];
      const result = await commands.enqueueConversationReply({
        context: input.context,
        conversationId: input.conversation.id,
        expectedVersion: input.conversation.version,
        body: input.body,
      });
      return isCommandSuccess(result)
        ? productActionSuccess(result.value, steps, "Reply was accepted by the server outbound queue.")
        : productActionFailure(result.error, steps, "enqueueConversationReply");
    },
  };
}
