import { describe, expect, it } from "vitest";
import type { MessageDTO } from "../../src/contracts";
import { buildInboxThreadView } from "../../src/features/inbox/view-models";
import { sampleConversation } from "../../src/features/operations/sample-data";

const messages: MessageDTO[] = [
  { id: "msg_provider_accepted", workspaceId: sampleConversation.workspaceId, conversationId: sampleConversation.id, direction: "OUTBOUND", senderKind: "STAFF", body: "Your quote is ready.", deliveryState: "PROVIDER_ACCEPTED", createdAt: "2026-10-04T06:20:00.000Z" },
  { id: "msg_delivered", workspaceId: sampleConversation.workspaceId, conversationId: sampleConversation.id, direction: "OUTBOUND", senderKind: "STAFF", body: "Your visit is confirmed.", deliveryState: "DELIVERED", createdAt: "2026-10-04T06:25:00.000Z" },
  { id: "msg_read", workspaceId: sampleConversation.workspaceId, conversationId: sampleConversation.id, direction: "OUTBOUND", senderKind: "STAFF", body: "Crew is on the way.", deliveryState: "READ", createdAt: "2026-10-04T06:30:00.000Z" },
  { id: "msg_failed", workspaceId: sampleConversation.workspaceId, conversationId: sampleConversation.id, direction: "OUTBOUND", senderKind: "SYSTEM", body: "Reminder failed to send.", deliveryState: "FAILED", createdAt: "2026-10-04T06:35:00.000Z" },
];

describe("inbox delivery state view model", () => {
  it("keeps provider accepted, delivered and read as distinct states", () => {
    const view = buildInboxThreadView({
      conversation: sampleConversation,
      customerLabel: "Sample customer",
      requestLabel: "MOVE_OUT · QUOTED",
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
