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

  test("does not transfer a provider receipt to another outbound message ID", () => {
    const saved = {
      providerMessageId: "msg-a", callbackKey: "cb-a",
      deliveryState: "DELIVERED" as const, occurredAt: "2026-10-14T08:00:00.000Z",
    };
    const newer = applyEmailCallbackLifecycle(saved, {
      callbackKey: "cb-b", providerMessageId: "msg-b",
      eventType: "BOUNCE", bounceType: "hard", occurredAt: "2026-10-14T09:00:00.000Z",
    });
    expect(newer).toMatchObject({ result: "OUT_OF_ORDER_IGNORED", next: saved });
    expect(newer.next.providerMessageId).toBe("msg-a");
    expect(newer.next.suppressionRequired).toBeUndefined();
  });

  test("ignores out-of-order callbacks even before a message reaches DELIVERED", () => {
    const saved = {
      providerMessageId: "msg-a", callbackKey: "cb-new",
      deliveryState: "RETRYABLE_FAILURE" as const, occurredAt: "2026-10-14T09:00:00.000Z",
    };
    for (const occurredAt of ["2026-10-14T08:00:00.000Z", "not-a-date"]) {
      const stale = applyEmailCallbackLifecycle(saved, {
        providerMessageId: "msg-a", callbackKey: "cb-old", eventType: "DELIVERED", occurredAt,
      });
      expect(stale).toMatchObject({ result: "OUT_OF_ORDER_IGNORED", next: saved });
    }
  });

  test("retains genuine delivery evidence while reviewing later hard bounce or complaint", () => {
    const saved = {
      providerMessageId: "msg-a", callbackKey: "delivered",
      deliveryState: "DELIVERED" as const, occurredAt: "2026-10-14T09:00:00.000Z",
    };
    for (const event of [
      { eventType: "BOUNCE" as const, bounceType: "hard" as const },
      { eventType: "COMPLAINT" as const },
    ]) {
      const result = applyEmailCallbackLifecycle(saved, {
        ...event, providerMessageId: "msg-a",
        callbackKey: "review-" + event.eventType,
        occurredAt: "2026-10-14T09:15:00.000Z",
      });
      expect(result).toMatchObject({
        result: "SUPPRESSION_REVIEW", next: { deliveryState: "DELIVERED", suppressionRequired: true },
      });
    }
    expect(applyEmailCallbackLifecycle(saved, {
      providerMessageId: "msg-a", callbackKey: "soft",
      eventType: "BOUNCE", bounceType: "soft", occurredAt: "2026-10-14T09:20:00.000Z",
    })).toMatchObject({ result: "OUT_OF_ORDER_IGNORED", next: saved });
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
