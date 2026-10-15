import { describe, expect, test } from "vitest";
import { dispatchCommittedOutboxJob } from "../../src/server/integrations/outbox/dispatch-router";
import { dispatchOutcomeBase, type CommittedOutboxDispatchOutcome } from "../../src/server/integrations/outbox/dispatch-port";
import type { OutboxJob } from "../../src/server/integrations/types";

const claimMs = Date.now() - 2 * 60_000;
const stamp = (offsetMs: number) => new Date(claimMs + offsetMs).toISOString();
const claimedAt = stamp(0);
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
      stamp(60_000), stamp(62_000));
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
      [stamp(86_401_000), stamp(86_401_000)],
      [stamp(0), stamp(86_460_000)],
      [stamp(-1000), stamp(60_000)],
      [stamp(60_000), stamp(59_000)],
    ] as const;
    for (const [accepted, captured] of bad) {
      const result = await attempt("LIVE", "PROVIDER_VERIFIED", accepted, captured);
      expect(result).toMatchObject({ ok: true, value: {
        outcome: "TERMINAL_FAILURE", code: "DISPATCH_OUTCOME_IDENTITY_MISMATCH",
      } });
    }
  });
});
