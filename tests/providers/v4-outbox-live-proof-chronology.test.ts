import { describe, expect, test } from "vitest";
import { dispatchCommittedOutboxJob } from "../../src/server/integrations/outbox/dispatch-router";
import { dispatchOutcomeBase, type CommittedOutboxDispatchOutcome } from "../../src/server/integrations/outbox/dispatch-port";
import type { OutboxJob } from "../../src/server/integrations/types";

const claimedAt = "2026-10-15T09:00:00.000Z";
const job: OutboxJob = {
  id: "job-quote", workspaceId: "ws-quoted", channel: "WHATSAPP", purpose: "QUOTE",
  recipient: { recipientRef: "ref-123", consentRequired: true, hasOptIn: true, optedOut: false },
  createdAt: claimedAt, idempotencyKey: "idem-quoted", payload: {},
};

async function attempt(mode: "LIVE" | "SANDBOX" | "FIXTURE",
  verification: "CONTRACT_TESTED" | "PROVIDER_VERIFIED", acceptedAt: string, capturedAt = acceptedAt) {
  return dispatchCommittedOutboxJob({
    job, committedAt: claimedAt, attempt: 1, expectedWorkspaceId: job.workspaceId,
    dispatchers: {
      WHATSAPP: { async dispatch() {
        return { ok: true, value: {
          ...dispatchOutcomeBase(job), outcome: "ACCEPTED", providerMode: mode,
          providerMessageId: "wamid.provider.abc", acceptedAt,
          evidence: { provider: "WHATSAPP", mode, verification, capturedAt, notes: [] },
        } as CommittedOutboxDispatchOutcome };
      } },
    },
  });
}

describe("V4 outbox LIVE acceptance evidence and chronology", () => {
  test("LIVE cannot claim accepted delivery using a contract-only test receipt", async () => {
    const result = await attempt("LIVE", "CONTRACT_TESTED", claimedAt);
    expect(result).toMatchObject({ ok: true, value: {
      outcome: "TERMINAL_FAILURE", code: "DISPATCH_OUTCOME_IDENTITY_MISMATCH",
    } });
  });
  test("permits realistic provider-verified live acceptance after a committed claim", async () => {
    const result = await attempt("LIVE", "PROVIDER_VERIFIED",
      "2026-10-15T09:01:00.000Z", "2026-10-15T09:01:02.000Z");
    expect(result).toMatchObject({ ok: true, value: {
      outcome: "ACCEPTED", providerMode: "LIVE", providerMessageId: "wamid.provider.abc",
      evidence: { verification: "PROVIDER_VERIFIED" },
    } });
  });
  test("retains explicit fixture acceptance for test-only dispatchers", async () => {
    const result = await attempt("FIXTURE", "CONTRACT_TESTED", claimedAt);
    expect(result).toMatchObject({ ok: true, value: { outcome: "ACCEPTED" } });
  });
  test("rejects provider-created far-future and out-of-order receipts", async () => {
    const bad = [
      ["2026-10-16T09:00:01.000Z", "2026-10-16T09:00:01.000Z"],
      ["2026-10-15T09:00:00.000Z", "2026-10-16T09:01:00.000Z"],
      ["2026-10-15T08:59:59.000Z", "2026-10-15T09:01:00.000Z"],
      ["2026-10-15T09:01:00.000Z", "2026-10-15T09:00:59.000Z"],
    ] as const;
    for (const [accepted, captured] of bad) {
      const result = await attempt("LIVE", "PROVIDER_VERIFIED", accepted, captured);
      expect(result).toMatchObject({ ok: true, value: {
        outcome: "TERMINAL_FAILURE", code: "DISPATCH_OUTCOME_IDENTITY_MISMATCH",
      } });
    }
  });
});
