import { describe, expect, it, vi } from "vitest";
import type { OutboxJob } from "../../src/server/integrations/types";
import { WebhookCommittedOutboxDispatcher } from
  "../../src/server/integrations/outbox/webhook-dispatcher";

const job = {
  id: "fictional-event-1",
  workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  channel: "WEBHOOK",
  purpose: "AUTOMATION",
  idempotencyKey: "fictional-idempotency-1",
} as unknown as OutboxJob;
const input = {
  job, committedAt: "2026-10-13T00:00:00Z", attempt: 1,
  expectedWorkspaceId: job.workspaceId, expectedChannel: "WEBHOOK" as const,
};
const resolved = {
  ok: true as const,
  value: {
    endpointId: "synthetic-n8n",
    url: "https://flows.example.com/controlled",
    body: { fictional: true },
    headers: { "content-type": "application/json" },
  },
};

describe("V4 protected webhook failure privacy and reliability", () => {
  it("never persists raw transport exception content", async () => {
    const secret = "fictional-provider-key-sk_live_do_not_store";
    const dispatcher = new WebhookCommittedOutboxDispatcher(
      { resolve: async () => resolved },
      async () => { throw new Error("POST failed: " + secret); },
    );
    const outcome = await dispatcher.dispatch(input);
    expect(outcome).toMatchObject({
      ok: true, value: { outcome: "RETRYABLE_FAILURE", code: "NETWORK_ERROR" },
    });
    expect(JSON.stringify(outcome)).not.toContain(secret);
    expect(JSON.stringify(outcome)).not.toContain("POST failed");
  });

  it("normalizes thrown resolver errors without dispatching", async () => {
    const transport = vi.fn();
    const dispatcher = new WebhookCommittedOutboxDispatcher(
      { resolve: async () => { throw Error("private-connector-key-in-stack"); } },
      transport,
    );
    const outcome = await dispatcher.dispatch(input);
    expect(outcome).toMatchObject({
      ok: true, value: { outcome: "TERMINAL_FAILURE", code: "WEBHOOK_CONFIG_INVALID" },
    });
    expect(JSON.stringify(outcome)).not.toContain("private-connector-key");
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not trust a resolver-supplied error code or message", async () => {
    const dispatcher = new WebhookCommittedOutboxDispatcher(
      { resolve: async () => ({
        ok: false as const,
        code: "MY_SECRET_KEY_EXPOSED",
        message: "raw-customer-text=private",
      }) },
      async () => { throw Error("transport should not execute"); },
    );
    const outcome = await dispatcher.dispatch(input);
    expect(outcome).toMatchObject({
      ok: true, value: { outcome: "TERMINAL_FAILURE", code: "WEBHOOK_CONFIG_INVALID" },
    });
    expect(JSON.stringify(outcome)).not.toContain("MY_SECRET_KEY");
    expect(JSON.stringify(outcome)).not.toContain("raw-customer-text");
  });

  it("continues recognizing explicit provider success", async () => {
    const dispatcher = new WebhookCommittedOutboxDispatcher(
      { resolve: async () => resolved },
      async () => ({ status: 202, providerMessageId: "synthetic-delivery-receipt" }),
      () => "2026-10-13T00:00:01Z",
    );
    const outcome = await dispatcher.dispatch(input);
    expect(outcome).toMatchObject({
      ok: true, value: {
        outcome: "ACCEPTED", providerMessageId: "synthetic-delivery-receipt",
      },
    });
  });
});
