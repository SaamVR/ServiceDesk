import { describe, expect, test } from "vitest";
import { resolveConversationReplyIntent } from "../../src/server/integrations/outbox/conversation-reply-intent";
import { hasRecipientSuppression } from "../../src/server/integrations/types";

function event(id = "outbox-1", conversationId = "conv-1", messageId = "msg-1") {
  return { id, workspaceId: "ws-1", topic: "conversation.reply", payload: { conversationId, messageId }, idempotencyKey: `idem-${id}`, attempt: 1, claimedAt: "2026-10-04T14:00:00.000Z" };
}

function source(overrides = {}) {
  return {
    eventId: "outbox-1",
    workspaceId: "ws-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    senderKind: "STAFF",
    channel: "EMAIL",
    recipient: { recipientRef: "customer@example.com", consentRequired: true, hasOptIn: true, optedOut: false },
    conversationVersion: 2,
    handoverActive: true,
    body: "Reply body",
    subject: "Reply",
    text: "Reply body",
    html: "<p>Reply body</p>",
    ...overrides,
  } as const;
}

describe("conversation reply intent resolver", () => {
  test("rejects claimed payload identity mismatch", async () => {
    const result = await resolveConversationReplyIntent(event("outbox-1", "wrong"), { async load() { return { ok: true, value: source() }; } });
    expect(result.ok).toBe(false);
  });

  test("creates CUSTOMER_REPLY jobs from authoritative STAFF source", async () => {
    const result = await resolveConversationReplyIntent(event(), { async load() { return { ok: true, value: source() }; } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.purpose).toBe("CUSTOMER_REPLY");
    expect(result.value.idempotencyKey).toBe("idem-outbox-1");
    expect(result.value.payload.email).toMatchObject({ to: "customer@example.com", subject: "Reply" });
    expect(hasRecipientSuppression(result.value)).toBeNull();
  });
});
