import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { handleEmailProviderCallback, type EmailCallbackStore } from "../../src/server/api-handlers/provider-email";

function signature(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

function store(): { calls: unknown[]; store: EmailCallbackStore } {
  const calls: unknown[] = [];
  return {
    calls,
    store: {
      applyEmailCallback: async (input) => {
        calls.push(input);
        return "APPLIED";
      },
    },
  };
}

describe("email provider callback handler", () => {
  test("rejects callback before parsing when signature is missing", async () => {
    const observed = store();
    const rawBody = JSON.stringify({ event: "bounce" });

    const result = await handleEmailProviderCallback({
      rawBody,
      headers: {},
      webhookSecret: "secret",
      store: observed.store,
    });

    expect(result).toMatchObject({ statusCode: 401, acknowledged: false, retryable: false });
    expect(observed.calls).toHaveLength(0);
  });

  test("applies hard bounce as permanent suppression", async () => {
    const observed = store();
    const rawBody = JSON.stringify({
      id: "evt_email_1",
      type: "bounce",
      workspaceId: "ws-clearnest",
      providerMessageId: "msg_123",
      recipientRef: "customer_123",
      occurredAt: "2026-10-04T12:00:00.000Z",
      bounceType: "hard",
      reason: "mailbox not found",
    });

    const result = await handleEmailProviderCallback({
      rawBody,
      headers: { "x-servicedesk-email-signature": signature(rawBody, "secret") },
      webhookSecret: "secret",
      store: observed.store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(observed.calls[0]).toMatchObject({
      callbackKey: "evt_email_1",
      eventType: "BOUNCE",
      suppressionAction: "SUPPRESS_RECIPIENT",
      bounceType: "hard",
      providerMessageId: "msg_123",
    });
  });

  test("complaint suppresses recipient and duplicates acknowledge without mutation", async () => {
    const calls: unknown[] = [];
    const duplicateStore: EmailCallbackStore = {
      applyEmailCallback: async (input) => {
        calls.push(input);
        return "DUPLICATE";
      },
    };
    const rawBody = JSON.stringify({
      id: "evt_email_2",
      type: "complaint",
      workspaceId: "ws-clearnest",
      providerMessageId: "msg_456",
      recipientRef: "customer_456",
      occurredAt: "2026-10-04T12:05:00.000Z",
      reason: "spam complaint",
    });

    const result = await handleEmailProviderCallback({
      rawBody,
      headers: { "x-servicedesk-email-signature": signature(rawBody, "secret") },
      webhookSecret: "secret",
      store: duplicateStore,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(calls[0]).toMatchObject({ eventType: "COMPLAINT", suppressionAction: "SUPPRESS_RECIPIENT" });
  });

  test("delivery callback does not suppress recipient", async () => {
    const observed = store();
    const rawBody = JSON.stringify({
      id: "evt_email_3",
      type: "delivered",
      workspaceId: "ws-clearnest",
      providerMessageId: "msg_789",
      recipientRef: "customer_789",
      occurredAt: "2026-10-04T12:10:00.000Z",
    });

    const result = await handleEmailProviderCallback({
      rawBody,
      headers: { "x-servicedesk-email-signature": signature(rawBody, "secret") },
      webhookSecret: "secret",
      store: observed.store,
    });

    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
    expect(observed.calls[0]).toMatchObject({ eventType: "DELIVERED", suppressionAction: "NONE" });
  });

  test("persistence failure asks provider to retry", async () => {
    const rawBody = JSON.stringify({
      id: "evt_email_4",
      type: "bounce",
      workspaceId: "ws-clearnest",
      providerMessageId: "msg_000",
      recipientRef: "customer_000",
      occurredAt: "2026-10-04T12:15:00.000Z",
    });

    const result = await handleEmailProviderCallback({
      rawBody,
      headers: { "x-servicedesk-email-signature": signature(rawBody, "secret") },
      webhookSecret: "secret",
      store: {
        applyEmailCallback: async () => {
          throw new Error("database unavailable");
        },
      },
    });

    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
