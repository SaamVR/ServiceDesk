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

  test("retries network errors without exposing secrets", () => {
    const retry = classifyWebhookDeliveryResult({ errorCode: "ECONNRESET", attempt: 2, maxAttempts: 5 });

    expect(retry).toMatchObject({ outcome: "RETRY", retryable: true, nextAttempt: 3 });
    expect(JSON.stringify(retry)).not.toContain("secret");
  });
});
