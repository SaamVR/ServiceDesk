import { describe, expect, it } from "vitest";
import { dispatchCommittedOutboxJob } from "../../src/server/integrations/outbox/dispatch-router";
import { dispatchOutcomeBase } from "../../src/server/integrations/outbox/dispatch-port";
import type { OutboxJob } from "../../src/server/integrations/types";

const micro = (iso: string, extra: string) => iso.slice(0, -1) + extra + "Z";
const job = (createdAt: string): OutboxJob => ({
  id: "outbox-micros", workspaceId: "workspace-micros", channel: "WHATSAPP",
  purpose: "QUOTE", idempotencyKey: "once-micros", createdAt, payload: {},
  recipient: { recipientRef: "fictional-recipient", consentRequired: true, hasOptIn: true, optedOut: false },
});

describe("R18 Postgres microsecond committed-outbox chronology", () => {
  it("accepts legitimate six-digit persisted timestamps with a fixture receipt", async () => {
    const base = new Date(Date.now() - 3000).toISOString();
    const createdAt = micro(base, "100");
    const claimedAt = micro(base, "200");
    const acceptedAt = micro(base, "300");
    const capturedAt = micro(base, "400");
    const claimed = job(createdAt);
    let invoked = 0;
    const result = await dispatchCommittedOutboxJob({
      job: claimed, committedAt: claimedAt, attempt: 1,
      expectedWorkspaceId: claimed.workspaceId,
      dispatchers: { WHATSAPP: { async dispatch({ job: incoming }) {
        invoked++;
        return { ok: true as const, value: {
          ...dispatchOutcomeBase(incoming), outcome: "ACCEPTED" as const,
          providerMessageId: "fixture-micro-ack", providerMode: "FIXTURE" as const,
          acceptedAt,
          evidence: { provider: "WHATSAPP" as const, mode: "FIXTURE" as const,
            verification: "CONTRACT_TESTED" as const, capturedAt, notes: [] },
        } };
      } } },
    });
    expect(invoked).toBe(1);
    expect(result).toMatchObject({ ok: true, value: { outcome: "ACCEPTED", providerMessageId: "fixture-micro-ack" } });
  });

  it("refuses an outbox claim before creation within the SAME millisecond", async () => {
    const base = new Date(Date.now() - 3000).toISOString();
    let invoked = 0;
    const result = await dispatchCommittedOutboxJob({
      job: job(micro(base, "900")), committedAt: micro(base, "100"),
      attempt: 1, expectedWorkspaceId: "workspace-micros",
      dispatchers: { WHATSAPP: { async dispatch() {
        invoked++; throw Error("PROVIDER_MUST_NOT_BE_CALLED");
      } } },
    });
    expect(invoked).toBe(0);
    expect(result).toMatchObject({ ok: true, value: {
      outcome: "TERMINAL_FAILURE", code: "OUTBOX_COMMIT_CLAIM_INVALID",
    } });
  });

  it("refuses provider acceptance or evidence recorded 1 microsecond before its predecessor", async () => {
    const base = new Date(Date.now() - 3000).toISOString();
    const committedAt = micro(base, "200");
    const claimed = job(micro(base, "100"));
    for (const evidence of [
      { acceptedAt: micro(base, "199"), capturedAt: micro(base, "900") },
      { acceptedAt: micro(base, "300"), capturedAt: micro(base, "299") },
    ]) {
      const result = await dispatchCommittedOutboxJob({
        job: claimed, committedAt, attempt: 1,
        expectedWorkspaceId: claimed.workspaceId,
        dispatchers: { WHATSAPP: { async dispatch({ job: incoming }) {
          return { ok: true as const, value: {
            ...dispatchOutcomeBase(incoming), outcome: "ACCEPTED" as const,
            providerMessageId: "micro-false-positive", providerMode: "FIXTURE" as const,
            acceptedAt: evidence.acceptedAt,
            evidence: { provider: "WHATSAPP" as const, mode: "FIXTURE" as const,
              verification: "CONTRACT_TESTED" as const, capturedAt: evidence.capturedAt, notes: [] },
          } };
        } } },
      });
      expect(result).toMatchObject({ ok: true, value: {
        outcome: "TERMINAL_FAILURE", code: "DISPATCH_OUTCOME_IDENTITY_MISMATCH",
      } });
      expect(JSON.stringify(result)).not.toContain("micro-false-positive");
    }
  });

  it("rejects invalid civil dates and non-UTC/overprecision claims before provider call", async () => {
    const createdAt = new Date(Date.now() - 3000).toISOString();
    let invoked = 0;
    for (const invalid of [
      "2026-02-30T12:00:00.123456Z",
      "2026-04-31T12:00:00.123456Z",
      "2026-10-17T12:00:00.1234567Z",
      "2026-10-17T12:00:00.123456+00:00",
      "2026-10-17T12:00:00",
    ]) {
      const result = await dispatchCommittedOutboxJob({
        job: job(createdAt), committedAt: invalid,
        attempt: 1, expectedWorkspaceId: "workspace-micros",
        dispatchers: { WHATSAPP: { async dispatch() {
          invoked++; throw Error("PROVIDER_MUST_NOT_BE_CALLED");
        } } },
      });
      expect(result).toMatchObject({ ok: true, value: { outcome: "TERMINAL_FAILURE", code: "OUTBOX_COMMIT_CLAIM_INVALID" } });
    }
    expect(invoked).toBe(0);
  });
});
