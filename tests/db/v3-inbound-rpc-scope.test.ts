import { describe, expect, it } from "vitest";
import { createPostgresConversationFacadeMethods } from "../../src/server/core/conversation-postgres";
import type { InboundMessageEvent } from "../../src/server/core/facade";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const event: InboundMessageEvent = {
  receiptKey: "ws-a:phone-a:wamid-1",
  workspaceId: "ws-a",
  channel: "WHATSAPP",
  providerAccountId: "phone-a",
  providerMessageId: "wamid-1",
  senderRef: "15551234567",
  occurredAt: "2026-10-11T01:00:00.000Z",
  contentKind: "TEXT",
  text: "Need a quote",
  rawProviderEventRef: "whatsapp_raw:ws-a:phone-a:abc123",
};
const success = {
  ok: true,
  state: "APPLIED",
  conversation: { id: "conv-a", workspaceId: "ws-a", channel: "WHATSAPP", version: 1, handoverActive: false },
  message: { id: "message-a", workspaceId: "ws-a", conversationId: "conv-a",
    direction: "INBOUND", senderKind: "CUSTOMER", providerMessageId: "wamid-1",
    createdAt: "2026-10-11T01:00:00.000Z" },
};

function facade(response: Record<string, unknown>) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return { data: response, error: null };
    },
  } as unknown as SupabaseRpcClient;
  return { facade: createPostgresConversationFacadeMethods(client), calls };
}

describe("trusted conversation RPC tenant-bound receipt", () => {
  it("accepts authoritative scoped inbound and selects the WhatsApp command", async () => {
    const { facade: methods, calls } = facade(success);
    const result = await methods.applyInboundMessage(event);
    expect(result).toMatchObject({ ok: true, value: {
      state: "APPLIED", conversation: { id: "conv-a", workspaceId: "ws-a" },
      message: { id: "message-a", providerMessageId: "wamid-1" },
    } });
    expect(calls).toEqual([{ name: "servicedesk_apply_inbound_message", args: { p_event: event } }]);
  });

  it("preserves the separate email inbound command", async () => {
    const { facade: methods, calls } = facade({
      ...success, state: "DUPLICATE",
      conversation: { ...success.conversation, channel: "EMAIL" },
      message: undefined,
    });
    const result = await methods.applyInboundMessage({ ...event, channel: "EMAIL" });
    expect(result).toMatchObject({ ok: true, value: { state: "DUPLICATE" } });
    expect(calls[0].name).toBe("servicedesk_apply_inbound_email_message");
  });

  it("fails closed on cross-workspace conversation or message response", async () => {
    const cases = [
      { conversation: { ...success.conversation, workspaceId: "foreign-workspace" } },
      { message: { ...success.message, workspaceId: "foreign-workspace" } },
      { message: { ...success.message, conversationId: "foreign-conversation" } },
      { message: { ...success.message, providerMessageId: "different-provider-message" } },
      { message: { ...success.message, providerMessageId: undefined } },
      { message: { ...success.message, direction: "OUTBOUND" } },
      { message: { ...success.message, senderKind: "AI" } },
      { message: { ...success.message, senderKind: "STAFF" } },
      { message: { ...success.message, id: undefined } },
      { conversation: { ...success.conversation, channel: "EMAIL" } },
      { conversation: { ...success.conversation, version: -1 } },
      { conversation: { ...success.conversation, version: 2.5 } },
      { conversation: { ...success.conversation, id: undefined } },
    ];
    for (const override of cases) {
      const { facade: methods } = facade({ ...success, ...override });
      const conversation = override.conversation as Record<string, unknown> | undefined;
      const brokenMessage=override.message as Record<string,unknown> | undefined;
      const malformed = (conversation && (
        !Number.isSafeInteger(conversation.version) ||
        (conversation.version as number) < 0 ||
        typeof conversation.id !== "string")) ||
        (brokenMessage && typeof brokenMessage.id !== "string");
      await expect(methods.applyInboundMessage(event)).resolves.toMatchObject({
        ok: false, code: malformed
          ? "INBOUND_RPC_ERROR_MALFORMED" : "INBOUND_RPC_SCOPE_MISMATCH",
      });
    }
  });

  it("never treats unknown or missing business states as successful", async () => {
    for (const state of ["SENT", "FAILED", "", null]) {
      const { facade: methods } = facade({ ...success, state });
      const result = await methods.applyInboundMessage(event);
      expect(result).toMatchObject({ ok: false, code: "INBOUND_RPC_INVALID_STATE" });
      expect(JSON.stringify(result)).not.toContain(event.text);
    }
  });

  it("preserves a business RPC rejection without inventing a conversation", async () => {
    const { facade: methods } = facade({
      ok: false, code: "INBOUND_FORBIDDEN", message: "blocked",
    });
    expect(await methods.applyInboundMessage(event))
      .toMatchObject({ ok: false, code: "INBOUND_FORBIDDEN" });
  });
});
