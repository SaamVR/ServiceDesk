import { describe, expect, it } from "vitest";
import { decideOutboxPersistence, minimumBackoffSeconds, type OutboxRetryPolicyInput } from "../../src/server/jobs/outbox-retry";

const clock = "2026-10-25T06:00:00.000Z";
const base: OutboxRetryPolicyInput = {
  event: { id: "r52-retry", attempt: 1 },
  maxAttempts: 4,
  outcome: { outcome: "RETRYABLE_FAILURE", failedAt: clock, code: "HTTP_503" },
};
const decide = (patch: Partial<OutboxRetryPolicyInput>) =>
  decideOutboxPersistence({ ...base, ...patch });

describe("R52 outbox retry integer and bounded scheduling", () => {
  it("preserves the normal one-minute retry and exponential maximum", () => {
    expect(decide({})).toMatchObject({ ok: true, value: {
      action: "markRetry", nextAttemptAt: "2026-10-25T06:01:00.000Z",
    } });
    expect(minimumBackoffSeconds(100, 60, 3600)).toBe(3600);
  });

  it("rejects unsafe attempt and max-attempt integers without persisting a decision", () => {
    for (const bad of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, 1.5, 0, -1]) {
      expect(decide({ event: { id: "r52-retry", attempt: bad } }))
        .toMatchObject({ ok: false, code: "OUTBOX_ATTEMPT_INVALID" });
      expect(decide({ maxAttempts: bad }))
        .toMatchObject({ ok: false, code: "OUTBOX_MAX_ATTEMPTS_INVALID" });
    }
  });

  it("rejects nonrepresentable or excessive retry policies before scheduling", () => {
    for (const bad of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, 0.5, 0, -1]) {
      expect(decide({ baseDelaySeconds: bad }))
        .toMatchObject({ ok: false, code: "OUTBOX_RETRY_CONFIG_INVALID" });
      expect(decide({ maxDelaySeconds: bad }))
        .toMatchObject({ ok: false, code: "OUTBOX_RETRY_CONFIG_INVALID" });
    }
    expect(decide({ baseDelaySeconds: 10, maxDelaySeconds: 604_801 }))
      .toMatchObject({ ok: false, code: "OUTBOX_RETRY_CONFIG_INVALID" });
    expect(decide({ baseDelaySeconds: 10, maxDelaySeconds: 604_800 })).toMatchObject({ ok: true });
  });

  it("rejects a provider Retry-After that exceeds exact integer precision", () => {
    for (const seconds of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, -1, 2.5]) {
      expect(decide({ outcome: {
        outcome: "RETRYABLE_FAILURE", failedAt: clock,
        code: "HTTP_503", retryAfterSeconds: seconds,
      } })).toMatchObject({ ok: false, code: "OUTBOX_RETRY_AFTER_INVALID" });
    }
    expect(decide({ outcome: {
      outcome: "RETRYABLE_FAILURE", failedAt: clock,
      code: "HTTP_503", retryAfterSeconds: 120,
    } })).toMatchObject({ ok: true, value: {
      action: "markRetry", nextAttemptAt: "2026-10-25T06:02:00.000Z",
    } });
  });
});
