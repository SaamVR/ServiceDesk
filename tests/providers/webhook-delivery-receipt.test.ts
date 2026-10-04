import { describe, expect, test } from "vitest";
import { mergeWebhookDeliveryReceipt, webhookDeliveryReceiptKey } from "../../src/server/integrations/webhook/receipt";

describe("webhook delivery receipt", () => {
  test("creates stable idempotency key from workspace endpoint and event", () => {
    expect(webhookDeliveryReceiptKey({ workspaceId: "ws-1", endpointId: "endpoint-1", eventId: "evt-1" })).toBe("webhook:ws-1:endpoint-1:evt-1");
  });

  test("preserves first delivered receipt across worker restart", () => {
    const current = mergeWebhookDeliveryReceipt(undefined, {
      workspaceId: "ws-1",
      endpointId: "endpoint-1",
      eventId: "evt-1",
      attempt: 1,
      outcome: "DELIVERED",
      capturedAt: "2026-10-04T08:00:00.000Z",
      endpointHost: "hooks.example.test",
    });
    const replay = mergeWebhookDeliveryReceipt(current.receipt, {
      workspaceId: "ws-1",
      endpointId: "endpoint-1",
      eventId: "evt-1",
      attempt: 2,
      outcome: "DELIVERED",
      capturedAt: "2026-10-04T08:01:00.000Z",
      endpointHost: "hooks.example.test",
    });

    expect(current).toMatchObject({ result: "INSERTED", receipt: { delivered: true, attempts: 1 } });
    expect(replay).toMatchObject({ result: "DUPLICATE_DELIVERED", receipt: { delivered: true, attempts: 1 } });
  });

  test("records retryable failure then updates until final failure or delivery", () => {
    const retry = mergeWebhookDeliveryReceipt(undefined, {
      workspaceId: "ws-1",
      endpointId: "endpoint-1",
      eventId: "evt-1",
      attempt: 1,
      outcome: "RETRY",
      capturedAt: "2026-10-04T08:00:00.000Z",
      endpointHost: "hooks.example.test",
      nextAttemptAt: "2026-10-04T08:02:00.000Z",
    });
    const final = mergeWebhookDeliveryReceipt(retry.receipt, {
      workspaceId: "ws-1",
      endpointId: "endpoint-1",
      eventId: "evt-1",
      attempt: 3,
      outcome: "FAILED_FINAL",
      capturedAt: "2026-10-04T08:10:00.000Z",
      endpointHost: "hooks.example.test",
    });

    expect(retry).toMatchObject({ result: "INSERTED", receipt: { delivered: false, finalFailure: false, nextAttemptAt: "2026-10-04T08:02:00.000Z" } });
    expect(final).toMatchObject({ result: "UPDATED", receipt: { delivered: false, finalFailure: true, attempts: 3 } });
  });
});
