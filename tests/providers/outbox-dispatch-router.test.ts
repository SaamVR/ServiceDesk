import { describe, expect, test } from "vitest";
import { dispatchCommittedOutboxJob } from "../../src/server/integrations/outbox/dispatch-router";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher, type CommittedOutboxDispatchOutcome } from "../../src/server/integrations/outbox/dispatch-port";
import type { OutboxJob } from "../../src/server/integrations/types";

function job(overrides: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: "outbox-1",
    workspaceId: "ws-1",
    channel: "WHATSAPP",
    purpose: "QUOTE",
    recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: true, optedOut: false },
    createdAt: "2026-10-04T12:00:00.000Z",
    idempotencyKey: "idem-1",
    payload: {},
    ...overrides,
  };
}

const dispatcher: CommittedOutboxDispatcher = {
  async dispatch(input) {
    return {
      ok: true,
      value: {
        ...dispatchOutcomeBase(input.job),
        outcome: "ACCEPTED",
        providerMessageId: "provider-message-1",
        acceptedAt: input.committedAt,
        providerMode: "FIXTURE",
        evidence: { provider: input.job.channel, mode: "FIXTURE", verification: "CONTRACT_TESTED", capturedAt: input.committedAt, notes: [] },
      },
    };
  },
};

describe("committed outbox dispatch router", () => {
  test("routes supported channel through injected dispatcher and preserves identity", async () => {
    const result = await dispatchCommittedOutboxJob({ job: job(), committedAt: "2026-10-04T12:01:00.000Z", attempt: 1, expectedWorkspaceId: "ws-1", dispatchers: { WHATSAPP: dispatcher } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ outcome: "ACCEPTED", jobId: "outbox-1", workspaceId: "ws-1", channel: "WHATSAPP", idempotencyKey: "idem-1" });
  });

  test("re-checks suppression and fails unsupported dispatchers closed", async () => {
    const suppressed = await dispatchCommittedOutboxJob({ job: job({ recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: true, optedOut: true } }), committedAt: "2026-10-04T12:01:00.000Z", attempt: 1, dispatchers: { WHATSAPP: dispatcher } });
    expect(suppressed.ok && suppressed.value.outcome).toBe("SUPPRESSED");

    const unsupported = await dispatchCommittedOutboxJob({ job: job({ channel: "WEBHOOK" }), committedAt: "2026-10-04T12:01:00.000Z", attempt: 1, dispatchers: { WHATSAPP: dispatcher } });
    expect(unsupported.ok && unsupported.value).toMatchObject({ outcome: "TERMINAL_FAILURE", code: "UNSUPPORTED_DISPATCH_CHANNEL" });
  });

  test("rejects mismatched adapter receipts before downstream outbox accounting", async () => {
    const claimed = job();
    const base = {
      ...dispatchOutcomeBase(claimed),
      outcome: "ACCEPTED" as const,
      providerMessageId: "synthetic-receipt",
      acceptedAt: "2026-10-11T00:00:00Z",
      providerMode: "FIXTURE" as const,
      evidence: { provider: "WHATSAPP" as const, mode: "FIXTURE" as const, verification: "CONTRACT_TESTED" as const,
        capturedAt: "2026-10-11T00:00:00Z", notes: [] },
    };
    for (const invalid of [
      { jobId: "different" },
      { workspaceId: "foreign-workspace" },
      { channel: "EMAIL" as const },
      { purpose: "INVOICE" as const },
      { idempotencyKey: "foreign-idempotency-key" },
      { providerMessageId: " " },
    ]) {
      const response = await dispatchCommittedOutboxJob({
        job: claimed, committedAt: "2026-10-11T00:00:00Z", attempt: 1,
        expectedWorkspaceId: "ws-1",
        dispatchers: { WHATSAPP: {
          async dispatch() { return { ok: true as const, value: { ...base, ...invalid } }; },
        } },
      });
      expect(response).toMatchObject({
        ok: true,
        value: {
          outcome: "TERMINAL_FAILURE",
          code: "DISPATCH_OUTCOME_IDENTITY_MISMATCH",
          jobId: claimed.id,
          workspaceId: claimed.workspaceId,
        },
      });
      expect(JSON.stringify(response)).not.toContain("foreign-idempotency-key");
    }
  });

  test("rejects forged, unbounded or cross-channel successful provider receipts", async () => {
    const claimed = job();
    const base = {
      ...dispatchOutcomeBase(claimed),
      outcome: "ACCEPTED" as const,
      providerMessageId: "wamid.1234",
      acceptedAt: "2026-10-13T04:20:00.000Z",
      providerMode: "SANDBOX" as const,
      evidence: { provider: "WHATSAPP" as const, mode: "SANDBOX" as const,
        verification: "PROVIDER_VERIFIED" as const,
        capturedAt: "2026-10-13T04:20:00.000Z", notes: [] },
    };
    for (const patch of [
      { providerMessageId: "x".repeat(513) },
      { providerMessageId: "forged\nreceipt" },
      { acceptedAt: "not-a-date" },
      { acceptedAt: "2026-13-01T00:00:00Z" },
      { acceptedAt: "2026-02-30T04:20:00Z" },
      { acceptedAt: "2026-04-31T04:20:00Z" },
      { acceptedAt: "2026-10-13T25:20:00Z" },
      { acceptedAt: "2026-10-13T04:20:60Z" },
      { evidence: { ...base.evidence, capturedAt: "2026-02-30T04:20:00Z" } },
      { providerMode: "OTHER" },
      { evidence: { ...base.evidence, provider: "EMAIL" } },
      { evidence: { ...base.evidence, mode: "LIVE" } },
      { evidence: { ...base.evidence, verification: "CONFIGURATION_BLOCKED" } },
      { evidence: { ...base.evidence, capturedAt: "unknown" } },
      { evidence: null },
    ]) {
      const result = await dispatchCommittedOutboxJob({
        job: claimed, committedAt: base.acceptedAt, attempt: 1,
        expectedWorkspaceId: claimed.workspaceId,
        dispatchers: { WHATSAPP: {
          async dispatch() { return { ok: true as const, value: { ...base, ...patch } as unknown as CommittedOutboxDispatchOutcome }; },
        } },
      });
      expect(result).toMatchObject({
        ok: true, value: { outcome: "TERMINAL_FAILURE", code: "DISPATCH_OUTCOME_IDENTITY_MISMATCH" },
      });
      expect(JSON.stringify(result)).not.toContain("forged\\nreceipt");
    }
  });

  test("does not expose thrown provider exception messages in persistent dispatch outcome", async () => {
    const sensitive = "Bearer super-secret-key customer@example.test token=do-not-log";
    const response = await dispatchCommittedOutboxJob({
      job: job(), committedAt: "2026-10-11T00:00:00Z", attempt: 1,
      dispatchers: { WHATSAPP: {
        async dispatch() { throw new Error(sensitive); },
      } },
    });
    expect(response).toMatchObject({
      ok: true, value: { outcome: "TERMINAL_FAILURE", code: "UNKNOWN_PROVIDER_FAILURE" },
    });
    expect(JSON.stringify(response)).not.toContain("super-secret-key");
    expect(JSON.stringify(response)).not.toContain("customer@example.test");
    expect(JSON.stringify(response)).not.toContain("do-not-log");
  });

  test("preserves legitimate retry and suppression outcomes with the original job identity", async () => {
    for (const outcome of ["RETRYABLE_FAILURE", "SUPPRESSED"] as const) {
      const claimed = job();
      const response = await dispatchCommittedOutboxJob({
        job: claimed, committedAt: "2026-10-11T00:00:00Z", attempt: 1,
        dispatchers: { WHATSAPP: {
          async dispatch() { return { ok: true as const, value: {
            ...dispatchOutcomeBase(claimed), outcome, code: "CONTROLLED", message: "Controlled provider result",
          } }; },
        } },
      });
      expect(response).toMatchObject({ ok: true, value: { outcome, jobId: claimed.id } });
    }
  });

});
