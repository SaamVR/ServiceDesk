import type { ConversationDTO, MessageDTO } from "@/contracts";
import { InboxPreview } from "./InboxPreview";

const fixtureConversation: ConversationDTO = {
  id: "conv_showcase_001",
  workspaceId: "ws_showcase",
  requestId: "req_moveout_001",
  customerId: "cust_sample",
  channel: "WHATSAPP",
  assignedUserId: "dispatcher_1",
  handoverActive: true,
  version: 8,
  lastMessageAt: "2026-10-04T06:25:00.000Z",
};

const fixtureMessages: MessageDTO[] = [
  {
    id: "msg_inbound_change",
    workspaceId: fixtureConversation.workspaceId,
    conversationId: fixtureConversation.id,
    direction: "INBOUND",
    senderKind: "CUSTOMER",
    body: "Can I move the visit to Friday morning?",
    createdAt: "2026-10-04T06:18:00.000Z",
  },
  {
    id: "msg_provider_accepted",
    workspaceId: fixtureConversation.workspaceId,
    conversationId: fixtureConversation.id,
    direction: "OUTBOUND",
    senderKind: "STAFF",
    body: "I am checking the crew schedule before confirming.",
    deliveryState: "PROVIDER_ACCEPTED",
    createdAt: "2026-10-04T06:20:00.000Z",
  },
  {
    id: "msg_delivery_failed",
    workspaceId: fixtureConversation.workspaceId,
    conversationId: fixtureConversation.id,
    direction: "OUTBOUND",
    senderKind: "SYSTEM",
    body: "Reminder send failed and needs reconciliation.",
    deliveryState: "FAILED",
    createdAt: "2026-10-04T06:25:00.000Z",
  },
];

export function buildFixtureInboxSnapshot() {
  return {
    conversation: fixtureConversation,
    messages: fixtureMessages,
    customerLabel: "Sample customer",
    requestLabel: "MOVE_OUT · QUOTED",
    actionAvailability: {
      handoverEnabled: false,
      replyEnabled: false,
      handoverLabel: "Fixture handover disabled",
      replyLabel: "Fixture reply disabled",
      disabledReason: "Fixture preview only; E05 inbox server actions are not wired into this route.",
    },
  };
}

export function InboxFixturePreview() {
  return <InboxPreview {...buildFixtureInboxSnapshot()} fixtureLabel="FIXTURE_UI_ONLY" />;
}
