import { describe, expect, test } from "vitest";
import { classifyProviderFailure } from "../../src/server/integrations/outbox/failure-policy";
import type { OutboxJob } from "../../src/server/integrations/types";

const job: OutboxJob = {
  id: "outbox-1",
  workspaceId: "ws-1",
  channel: "EMAIL",
  purpose: "INVOICE",
  recipient: { recipientRef: "customer-1", consentRequired: false, hasOptIn: false, optedOut: false },
  createdAt: "2026-10-04T12:00:00.000Z",
  idempotencyKey: "idem-1",
  payload: {},
};

describe("outbox provider failure policy", () => {
  test("classifies retryable, terminal, suppressed, and unknown failures", () => {
    expect(classifyProviderFailure({ job, code: "TIMEOUT" })).toMatchObject({ outcome: "RETRYABLE_FAILURE" });
    expect(classifyProviderFailure({ job, code: "RATE_LIMITED" })).toMatchObject({ outcome: "RETRYABLE_FAILURE" });
    expect(classifyProviderFailure({ job, code: "AUTHENTICATION_FAILED" })).toMatchObject({ outcome: "TERMINAL_FAILURE" });
    expect(classifyProviderFailure({ job, code: "RECIPIENT_OPTED_OUT" })).toMatchObject({ outcome: "SUPPRESSED" });
    expect(classifyProviderFailure({ job, code: "UNSEEN_VENDOR_CODE" })).toMatchObject({ outcome: "TERMINAL_FAILURE", code: "UNSEEN_VENDOR_CODE" });
  });
});
