import { describe, expect, it } from "vitest";
import { decideOutboxPersistence, type OutboxRetryPolicyInput } from
  "../../src/server/jobs/outbox-retry";

const date = "2026-10-25T05:00:00.000Z";
const base: OutboxRetryPolicyInput = {
  event: { id: "event-r51", attempt: 1 },
  outcome: { outcome: "RETRYABLE_FAILURE", failedAt: date, code: "HTTP_503" },
  maxAttempts: 3,
};
const decide = (outcome: unknown) => decideOutboxPersistence({
  ...base, outcome: outcome as OutboxRetryPolicyInput["outcome"],
});

describe("R51 untrusted outbox executor outcome boundary", () => {
  it("preserves an actual normalized retryable failure with a bounded schedule", () => {
    expect(decide({ outcome: "RETRYABLE_FAILURE", failedAt: date, code: "HTTP_503" }))
      .toMatchObject({ ok: true, value: {
        action: "markRetry", errorCode: "HTTP_503",
        nextAttemptAt: "2026-10-25T05:01:00.000Z",
      } });
  });

  it("preserves a safe provider terminal failure and deliberate suppression", () => {
    expect(decide({ outcome: "TERMINAL_FAILURE", failedAt: date, code: "FORBIDDEN" }))
      .toMatchObject({ ok: true, value: { action: "markFailed", errorCode: "FORBIDDEN" } });
    expect(decide({ outcome: "SUPPRESSED", failedAt: date, code: "RECIPIENT_OPTED_OUT" }))
      .toMatchObject({ ok: true, value: { action: "markSuppressed", code: "RECIPIENT_OPTED_OUT" } });
    expect(decide({ outcome: "SENT", completedAt: date, providerReference: "wamid.HBg123" }))
      .toMatchObject({ ok: true, value: { action: "markSent" } });
  });

  it("rejects unknown outcome tags instead of misclassifying them as retryable failures", () => {
    for (const outcome of ["FAILED", "PAID", "DELIVERED", "", 1, null]) {
      const result = decide({ outcome, failedAt: date, code: "HTTP_503" });
      expect(result).toMatchObject({ ok: false, code: "OUTBOX_OUTCOME_INVALID" });
    }
  });

  it("does not persist or echo raw provider text, credentials or customer contacts as error codes", () => {
    const unsafe = [
      "", "provider error", "customer@example.test", "https://vendor.test",
      "Bearer_private_token", "sk-test-secret", "PAYMENT\nCONFIRMED",
      "X".repeat(97), "UNKNOWN/FORBIDDEN", "HTTP-500",
    ];
    for (const outcome of ["RETRYABLE_FAILURE", "TERMINAL_FAILURE", "SUPPRESSED"] as const) {
      for (const code of unsafe) {
        const result = decide({ outcome, failedAt: date, code });
        expect(result).toMatchObject({ ok: false, code: "OUTBOX_FAILURE_CODE_INVALID" });
        if (code.length > 0) expect(JSON.stringify(result)).not.toContain(code);
      }
    }
  });
});
