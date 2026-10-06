import { describe, expect, it } from "vitest";
import { createConversationFacadeMethods } from "../../src/server/core/inbound-message";

describe("inbound message facade", () => {
  it("rejects invalid inbound identities before repository mutation", async () => {
    const facade = createConversationFacadeMethods({ conversationRepository: { transaction: async () => { throw new Error("should not run"); } } });
    await expect(facade.applyInboundMessage({
      receiptKey: "", workspaceId: "ws_1", channel: "WHATSAPP", providerAccountId: "acct", providerMessageId: "msg",
      senderRef: "+15550000001", occurredAt: "2026-10-04T06:00:00.000Z", contentKind: "TEXT", text: "hello", rawProviderEventRef: "ref",
    })).resolves.toEqual({ ok: false, code: "INBOUND_RECEIPT_REQUIRED", message: "Inbound receipt key is required." });
  });

  it("rejects unsupported content without provider calls", async () => {
    const facade = createConversationFacadeMethods({ conversationRepository: { transaction: async () => { throw new Error("should not run"); } } });
    await expect(facade.applyInboundMessage({
      receiptKey: "r1", workspaceId: "ws_1", channel: "WHATSAPP", providerAccountId: "acct", providerMessageId: "msg",
      senderRef: "+15550000001", occurredAt: "2026-10-04T06:00:00.000Z", contentKind: "UNSUPPORTED", rawProviderEventRef: "ref",
    })).resolves.toEqual({ ok: false, code: "INBOUND_CONTENT_UNSUPPORTED", message: "Inbound content kind is not business-processable." });
  });

  it("rejects inbound email media before repository mutation", async () => {
    const facade = createConversationFacadeMethods({
      conversationRepository: { transaction: async () => { throw new Error("should not run"); } },
    });
    await expect(facade.applyInboundMessage({
      receiptKey: "email-r1",
      workspaceId: "ws_1",
      channel: "EMAIL",
      providerAccountId: "mailbox-1",
      providerMessageId: "email-msg-1",
      senderRef: "person@example.com",
      occurredAt: "2026-10-07T01:00:00.000Z",
      contentKind: "MEDIA_REFERENCE",
      media: { provider: "WHATSAPP", providerMediaId: "not-used-for-email" },
      rawProviderEventRef: "email-event:1",
    })).resolves.toEqual({
      ok: false,
      code: "INBOUND_EMAIL_MEDIA_UNSUPPORTED",
      message: "Inbound email attachments are not supported by this intake boundary yet.",
    });
  });

});
