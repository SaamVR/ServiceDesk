export type TemporaryDeliveryState = "QUEUED" | "RUNNING" | "PROVIDER_ACCEPTED" | "DELIVERED" | "READ" | "FAILED" | "DEAD_LETTER";

export interface TemporaryInboxMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  authorLabel: string;
  body: string;
  deliveryState?: TemporaryDeliveryState;
  occurredAt: string;
}

export interface InboxMessageView {
  id: string;
  direction: TemporaryInboxMessage["direction"];
  authorLabel: string;
  body: string;
  deliveryLabel: string;
  tone: "neutral" | "pending" | "success" | "failure";
}

export interface InboxThreadView {
  id: string;
  customerLabel: string;
  requestLabel: string;
  statusSummary: string;
  messages: InboxMessageView[];
}

export function buildInboxThreadView(input: {
  id: string;
  customerLabel: string;
  requestLabel: string;
  handoverActive: boolean;
  messages: TemporaryInboxMessage[];
}): InboxThreadView {
  return {
    id: input.id,
    customerLabel: input.customerLabel,
    requestLabel: input.requestLabel,
    statusSummary: `${input.handoverActive ? "Human handover active" : "AI assistance available"} · ${input.messages.length} messages`,
    messages: input.messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      authorLabel: message.authorLabel,
      body: message.body,
      deliveryLabel: deliveryLabel(message.deliveryState, message.direction),
      tone: deliveryTone(message.deliveryState),
    })),
  };
}

function deliveryLabel(state: TemporaryDeliveryState | undefined, direction: TemporaryInboxMessage["direction"]) {
  if (direction === "INBOUND") {
    return "Customer message received";
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
    case "DEAD_LETTER":
      return "Dead-lettered — manual recovery required";
    default:
      return "Delivery state pending";
  }
}

function deliveryTone(state: TemporaryDeliveryState | undefined): InboxMessageView["tone"] {
  switch (state) {
    case "PROVIDER_ACCEPTED":
    case "QUEUED":
    case "RUNNING":
      return "pending";
    case "DELIVERED":
    case "READ":
      return "success";
    case "FAILED":
    case "DEAD_LETTER":
      return "failure";
    default:
      return "neutral";
  }
}
