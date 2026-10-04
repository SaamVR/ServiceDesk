import type { ConversationDTO, MessageDeliveryState, MessageDTO } from "@/contracts";
import type { ProductActionState } from "@/features/operations/action-state";

export interface InboxActionAvailability {
  handoverEnabled: boolean;
  replyEnabled: boolean;
  handoverLabel?: string;
  replyLabel?: string;
  disabledReason?: string;
}

export interface InboxThreadInput {
  conversation: ConversationDTO;
  messages: MessageDTO[];
  customerLabel: string;
  requestLabel: string;
  actionAvailability?: InboxActionAvailability;
  actionState?: ProductActionState;
}

export interface InboxMessageView {
  id: string;
  direction: MessageDTO["direction"];
  authorLabel: string;
  body: string;
  deliveryLabel: string;
  tone: "neutral" | "pending" | "success" | "failure" | "attention";
}

export interface InboxThreadView {
  id: string;
  customerLabel: string;
  requestLabel: string;
  statusSummary: string;
  handoverLabel: string;
  messages: InboxMessageView[];
  actionAvailability: Required<InboxActionAvailability>;
  actionState?: ProductActionState;
}

const defaultActionAvailability: Required<InboxActionAvailability> = {
  handoverEnabled: false,
  replyEnabled: false,
  handoverLabel: "Handover waits for accepted E05 command",
  replyLabel: "Reply waits for accepted E05 command",
  disabledReason: "Preview only; server-backed inbox actions are not wired into this route yet.",
};

export function buildInboxThreadView(input: InboxThreadInput): InboxThreadView {
  const actionAvailability = { ...defaultActionAvailability, ...input.actionAvailability };
  return {
    id: input.conversation.id,
    customerLabel: input.customerLabel,
    requestLabel: input.requestLabel,
    statusSummary: `${input.conversation.handoverActive ? "Human handover active" : "AI assistance available"} · ${input.messages.length} messages`,
    handoverLabel: input.conversation.handoverActive ? "Human-owned conversation" : "Automation may draft only after server policy check",
    messages: input.messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      authorLabel: authorLabel(message.senderKind),
      body: message.body ?? (message.mediaReference ? "Media attachment" : "No message body supplied"),
      deliveryLabel: deliveryLabel(message.deliveryState, message.direction),
      tone: deliveryTone(message.deliveryState, message.direction),
    })),
    actionAvailability,
    actionState: input.actionState,
  };
}

function authorLabel(senderKind: MessageDTO["senderKind"]): string {
  switch (senderKind) {
    case "CUSTOMER":
      return "Customer";
    case "STAFF":
      return "Staff";
    case "AI":
      return "AI assistant";
    case "SYSTEM":
      return "System";
  }
}

function deliveryLabel(state: MessageDeliveryState | undefined, direction: MessageDTO["direction"]) {
  if (direction === "INBOUND") {
    return "Customer message received";
  }
  if (direction === "INTERNAL") {
    return "Internal note";
  }

  switch (state) {
    case "QUEUED":
      return "Queued for sending";
    case "RUNNING":
      return "Sending now";
    case "PROVIDER_ACCEPTED":
      return "Provider accepted — not proof of delivery";
    case "DELIVERED":
      return "Delivered to recipient device";
    case "READ":
      return "Read by recipient";
    case "FAILED":
      return "Failed — staff recovery required";
    case "SUPPRESSED":
      return "Suppressed by consent/policy";
    default:
      return "Delivery state pending";
  }
}

function deliveryTone(state: MessageDeliveryState | undefined, direction: MessageDTO["direction"]): InboxMessageView["tone"] {
  if (direction === "INBOUND" || direction === "INTERNAL") {
    return "neutral";
  }

  switch (state) {
    case "PROVIDER_ACCEPTED":
    case "QUEUED":
    case "RUNNING":
      return "pending";
    case "DELIVERED":
    case "READ":
      return "success";
    case "FAILED":
      return "failure";
    case "SUPPRESSED":
      return "attention";
    default:
      return "neutral";
  }
}
