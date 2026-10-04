import { describe, expect, test } from "vitest";
import { applyEmailCallbackLifecycle, summarizeEmailCallback } from "../../src/server/integrations/email/lifecycle";

describe("email callback lifecycle", () => {
  test("applies delivered once and treats duplicate provider callbacks as no-op", () => {
    const first = applyEmailCallbackLifecycle(undefined, {
      callbackKey: "cb-1",
      providerMessageId: "msg-1",
      eventType: "DELIVERED",
      occurredAt: "2026-10-04T08:00:00.000Z",
    });
    const duplicate = applyEmailCallbackLifecycle(first.next, {
      callbackKey: "cb-1",
      providerMessageId: "msg-1",
      eventType: "DELIVERED",
      occurredAt: "2026-10-04T08:00:00.000Z",
    });

    expect(first).toMatchObject({ result: "APPLIED", next: { deliveryState: "DELIVERED" } });
    expect(duplicate).toMatchObject({ result: "DUPLICATE", next: { deliveryState: "DELIVERED" } });
  });

  test("does not let stale bounce regress delivered email proof", () => {
    const result = applyEmailCallbackLifecycle(
      { providerMessageId: "msg-1", callbackKey: "cb-delivered", deliveryState: "DELIVERED", occurredAt: "2026-10-04T09:00:00.000Z" },
      { callbackKey: "cb-old", providerMessageId: "msg-1", eventType: "BOUNCE", bounceType: "hard", occurredAt: "2026-10-04T08:30:00.000Z" },
    );

    expect(result).toMatchObject({ result: "OUT_OF_ORDER_IGNORED", next: { deliveryState: "DELIVERED" } });
  });

  test("complaint after delivery requires suppression review but preserves delivery proof", () => {
    const result = applyEmailCallbackLifecycle(
      { providerMessageId: "msg-1", callbackKey: "cb-delivered", deliveryState: "DELIVERED", occurredAt: "2026-10-04T09:00:00.000Z" },
      { callbackKey: "cb-complaint", providerMessageId: "msg-1", eventType: "COMPLAINT", occurredAt: "2026-10-04T09:10:00.000Z" },
    );

    expect(result).toMatchObject({ result: "SUPPRESSION_REVIEW", next: { deliveryState: "DELIVERED", suppressionRequired: true } });
  });

  test("redacted summary excludes email addresses and raw provider body", () => {
    const summary = summarizeEmailCallback({
      providerMessageId: "msg-abcdef123456",
      recipientRef: "customer-1",
      eventType: "BOUNCE",
      bounceType: "hard",
      reason: "user@example.com rejected message",
    });

    expect(summary).toMatchObject({ providerMessageRef: "msg…3456", recipientRef: "customer-1", eventType: "BOUNCE" });
    expect(JSON.stringify(summary)).not.toContain("user@example.com");
  });
});
