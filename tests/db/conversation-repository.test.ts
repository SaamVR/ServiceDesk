import { describe, expect, it } from "vitest";
import { conversationToDTO, messageToDTO, providerThreadId } from "../../src/domain/conversations";

describe("conversation repository contracts", () => {
  it("derives stable provider thread identity", () => {
    expect(providerThreadId("WHATSAPP", "acct_1", "+15550000001")).toBe("WHATSAPP:acct_1:+15550000001");
    expect(providerThreadId("EMAIL", "mailbox_1", " Person@Example.COM ")).toBe("EMAIL:mailbox_1:person@example.com");
  });

  it("maps conversation and message records to public DTOs without leaking receipt metadata", () => {
    expect(conversationToDTO({
      id: "conv_1", workspaceId: "ws_1", customerId: "cust_1", channel: "WHATSAPP", handoverActive: true,
      assignedUserId: "owner_1", handoverOwnerRevision: 1, version: 2, lastMessageAt: "2026-10-04T06:00:00.000Z",
      createdAt: "2026-10-04T06:00:00.000Z", updatedAt: "2026-10-04T06:00:00.000Z",
    })).toEqual({ id: "conv_1", workspaceId: "ws_1", customerId: "cust_1", channel: "WHATSAPP", handoverActive: true, assignedUserId: "owner_1", version: 2, lastMessageAt: "2026-10-04T06:00:00.000Z" });

    expect(messageToDTO({
      id: "msg_1", workspaceId: "ws_1", conversationId: "conv_1", direction: "INBOUND", senderKind: "CUSTOMER",
      providerMessageId: "wamid_1", providerReceiptKey: "receipt_1", body: "hello", deliveryState: "DELIVERED", createdAt: "2026-10-04T06:00:00.000Z",
    })).toEqual({ id: "msg_1", workspaceId: "ws_1", conversationId: "conv_1", direction: "INBOUND", senderKind: "CUSTOMER", providerMessageId: "wamid_1", body: "hello", deliveryState: "DELIVERED", createdAt: "2026-10-04T06:00:00.000Z" });
  });
});
