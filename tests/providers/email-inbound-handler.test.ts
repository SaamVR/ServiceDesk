import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleEmailInboundWebhook } from "../../src/server/api-handlers/provider-email-inbound";

const secret = "email-inbound-secret";
const payload = {
  workspaceId: "attacker-selected-workspace",
  providerAccountId: "mailbox-1",
  providerMessageId: "message-1",
  receiptKey: "receipt-1",
  senderEmail: "Person@Example.com",
  occurredAt: "2026-10-07T02:00:00.000Z",
  text: "Can we move Friday's visit?",
};

function signature(rawBody: string) {
  return "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
}

describe("email inbound webhook handler", () => {
  it("maps provider account to server-authorized workspace and never trusts payload workspace", async () => {
    const rawBody = JSON.stringify(payload);
    const applyInboundMessage = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        state: "APPLIED",
        conversation: {
          id: "conversation-1",
          workspaceId: "workspace-authorized",
          channel: "EMAIL",
          handoverActive: false,
          version: 1,
        },
      },
    });
    const result = await handleEmailInboundWebhook({
      rawBody,
      headers: { "x-servicedesk-email-signature": signature(rawBody) },
      webhookSecret: secret,
      workspaceByProviderAccountId: { "mailbox-1": "workspace-authorized" },
      store: { applyInboundMessage } as never,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(applyInboundMessage).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace-authorized",
      channel: "EMAIL",
      providerAccountId: "mailbox-1",
      senderRef: "person@example.com",
    }));
    const event = applyInboundMessage.mock.calls[0]?.[0];
    expect(event.workspaceId).not.toBe("attacker-selected-workspace");
    expect(event.rawProviderEventRef).toMatch(/^email-webhook:sha256:[a-f0-9]{64}$/);
    expect(event.rawProviderEventRef).not.toContain("Can we move");
  });

  it("rejects unmapped provider accounts before persistence", async () => {
    const rawBody = JSON.stringify(payload);
    const applyInboundMessage = vi.fn();
    const result = await handleEmailInboundWebhook({
      rawBody,
      headers: { "x-servicedesk-email-signature": signature(rawBody) },
      webhookSecret: secret,
      workspaceByProviderAccountId: {},
      store: { applyInboundMessage } as never,
    });
    expect(result).toMatchObject({ statusCode: 400, acknowledged: false, retryable: false });
    expect(result.body).toContain("EMAIL_INBOUND_ACCOUNT_UNMAPPED");
    expect(applyInboundMessage).not.toHaveBeenCalled();
  });

  it("fails closed on attachment-bearing input", async () => {
    const rawBody = JSON.stringify({ ...payload, attachments: [{ id: "file-1" }] });
    const applyInboundMessage = vi.fn();
    const result = await handleEmailInboundWebhook({
      rawBody,
      headers: { "x-servicedesk-email-signature": signature(rawBody) },
      webhookSecret: secret,
      workspaceByProviderAccountId: { "mailbox-1": "workspace-authorized" },
      store: { applyInboundMessage } as never,
    });
    expect(result).toMatchObject({ statusCode: 400, acknowledged: false, retryable: false });
    expect(result.body).toContain("EMAIL_INBOUND_ATTACHMENTS_UNSUPPORTED");
    expect(applyInboundMessage).not.toHaveBeenCalled();
  });

  it("uses retryable failure only for authoritative persistence failure", async () => {
    const rawBody = JSON.stringify(payload);
    const applyInboundMessage = vi.fn().mockResolvedValue({
      ok: false,
      code: "INBOUND_RPC_ERROR",
      message: "database unavailable",
    });
    const result = await handleEmailInboundWebhook({
      rawBody,
      headers: { "x-servicedesk-email-signature": signature(rawBody) },
      webhookSecret: secret,
      workspaceByProviderAccountId: { "mailbox-1": "workspace-authorized" },
      store: { applyInboundMessage } as never,
    });
    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
