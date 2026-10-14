import { describe, expect, test } from "vitest";
import { classifyWebhookDeliveryResult, nextWebhookRetryAt } from "../../src/server/integrations/webhook/signed";

describe("outbound webhook retry policy", () => {
  test("retries transient 5xx provider responses with capped exponential backoff", () => {
    const first = classifyWebhookDeliveryResult({ statusCode: 503, attempt: 1, maxAttempts: 5 });
    expect(first).toMatchObject({ outcome: "RETRY", retryable: true, nextAttempt: 2 });

    expect(nextWebhookRetryAt({ now: "2026-10-04T09:00:00.000Z", attempt: 1 })).toBe("2026-10-04T09:01:00.000Z");
    expect(nextWebhookRetryAt({ now: "2026-10-04T09:00:00.000Z", attempt: 5 })).toBe("2026-10-04T09:16:00.000Z");
  });

  test("does not retry successful delivery or deterministic 4xx failures", () => {
    expect(classifyWebhookDeliveryResult({ statusCode: 204, attempt: 1, maxAttempts: 5 })).toMatchObject({ outcome: "DELIVERED", retryable: false });
    expect(classifyWebhookDeliveryResult({ statusCode: 400, attempt: 1, maxAttempts: 5 })).toMatchObject({ outcome: "FAILED_FINAL", retryable: false });
    expect(classifyWebhookDeliveryResult({ statusCode: 404, attempt: 1, maxAttempts: 5 })).toMatchObject({ outcome: "FAILED_FINAL", retryable: false });
  });

  test("marks exhausted retries as final failure without mutating business truth", () => {
    const exhausted = classifyWebhookDeliveryResult({ statusCode: 503, attempt: 5, maxAttempts: 5 });

    expect(exhausted).toMatchObject({ outcome: "FAILED_FINAL", retryable: false, reason: "MAX_ATTEMPTS_EXHAUSTED" });
    expect(exhausted.businessMutationAllowed).toBe(false);
  });

  test("corrupt provider receipts and retry counters never claim delivered or schedule a new send", () => {
    const invalid = [
      { statusCode: 200, attempt: 0, maxAttempts: 5 },
      { statusCode: 200, attempt: -1, maxAttempts: 5 },
      { statusCode: 200, attempt: 1.5, maxAttempts: 5 },
      { statusCode: 200, attempt: 1, maxAttempts: 0 },
      { statusCode: 200, attempt: 1, maxAttempts: 101 },
      { statusCode: 200, attempt: 6, maxAttempts: 5 },
      { statusCode: Number.NaN, attempt: 1, maxAttempts: 5 },
      { statusCode: 200, errorCode: "ECONNRESET", attempt: 1, maxAttempts: 5 },
      { statusCode: 99, attempt: 1, maxAttempts: 5 },
      { statusCode: 600, attempt: 1, maxAttempts: 5 },
      { errorCode: "provider secret in logs", attempt: 1, maxAttempts: 5 },
      { attempt: 1, maxAttempts: 5 },
    ];
    for (const row of invalid) {
      const decision = classifyWebhookDeliveryResult(row);
      expect(decision).toMatchObject({
        outcome: "FAILED_FINAL", retryable: false,
        businessMutationAllowed: false,
      });
      expect(decision).not.toHaveProperty("nextAttempt");
      expect(JSON.stringify(decision)).not.toContain("provider secret");
    }
  });

  test("rejects malformed and unbounded retry timestamps instead of synthesizing deadlines", () => {
    for (const input of [
      { now: "bad-date", attempt: 1 },
      { now: "2026-10-04T09:00:00Z", attempt: 0 },
      { now: "2026-10-04T09:00:00Z", attempt: Number.NaN },
      { now: "2026-10-04T09:00:00Z", attempt: 101 },
      { now: "2026-10-04T09:00:00Z", attempt: 1, maxDelayMinutes: 0 },
      { now: "2026-10-04T09:00:00Z", attempt: 1, maxDelayMinutes: 1441 },
    ]) expect(() => nextWebhookRetryAt(input)).toThrow(RangeError);
  });

  test("retries network errors without exposing secrets", () => {
    const retry = classifyWebhookDeliveryResult({ errorCode: "ECONNRESET", attempt: 2, maxAttempts: 5 });

    expect(retry).toMatchObject({ outcome: "RETRY", retryable: true, nextAttempt: 3 });
    expect(JSON.stringify(retry)).not.toContain("secret");
  });
});
