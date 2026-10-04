import { describe, expect, it } from "vitest";
import {
  buildInboxThreadView,
  type TemporaryInboxMessage,
} from "../../src/features/inbox/view-models";

const messages: TemporaryInboxMessage[] = [
  {
    id: "msg_provider_accepted",
    direction: "OUTBOUND",
    authorLabel: "Dispatcher",
    body: "Your quote is ready.",
    deliveryState: "PROVIDER_ACCEPTED",
    occurredAt: "2026-10-04T06:20:00.000Z",
  },
  {
    id: "msg_delivered",
    direction: "OUTBOUND",
    authorLabel: "Dispatcher",
    body: "Your visit is confirmed.",
    deliveryState: "DELIVERED",
    occurredAt: "2026-10-04T06:25:00.000Z",
  },
  {
    id: "msg_read",
    direction: "OUTBOUND",
    authorLabel: "Dispatcher",
    body: "Crew is on the way.",
    deliveryState: "READ",
    occurredAt: "2026-10-04T06:30:00.000Z",
  },
  {
    id: "msg_failed",
    direction: "OUTBOUND",
    authorLabel: "System",
    body: "Reminder failed to send.",
    deliveryState: "FAILED",
    occurredAt: "2026-10-04T06:35:00.000Z",
  },
];

describe("inbox delivery state view model", () => {
  it("keeps provider accepted, delivered and read as distinct states", () => {
    const view = buildInboxThreadView({
      id: "thread_001",
      customerLabel: "Sample customer",
      requestLabel: "MOVE_OUT · QUOTED",
      handoverActive: true,
      messages,
    });

    expect(view.statusSummary).toBe("Human handover active · 4 messages");
    expect(view.messages.map((message) => message.deliveryLabel)).toEqual([
      "Provider accepted — not proof of delivery",
      "Delivered to recipient device",
      "Read by recipient",
      "Failed — staff recovery required",
    ]);
    expect(view.messages[0].tone).toBe("pending");
    expect(view.messages[3].tone).toBe("failure");
  });
});
