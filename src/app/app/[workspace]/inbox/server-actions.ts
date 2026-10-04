import {
  buildInboxSnapshotFromWorkspaceSnapshot,
  createInboxServerActionFactory,
  type InboxCommandPort,
  type LoadInboxInput,
  type ReplyInput,
  type ToggleHandoverInput,
  type WorkspaceSnapshot,
} from "@/features/inbox/server-boundary";

export function createRouteLocalInboxBoundary(commands: InboxCommandPort) {
  const actions = createInboxServerActionFactory(commands);
  return {
    loadInbox(input: LoadInboxInput) {
      return actions.loadInbox(input);
    },
    setHandover(input: ToggleHandoverInput) {
      return actions.setHandover(input);
    },
    enqueueReply(input: ReplyInput) {
      return actions.enqueueReply(input);
    },
    mapSnapshot(snapshot: WorkspaceSnapshot, selectedConversationId: string) {
      return buildInboxSnapshotFromWorkspaceSnapshot(snapshot, selectedConversationId);
    },
  };
}
