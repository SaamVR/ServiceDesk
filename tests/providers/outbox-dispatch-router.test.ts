import { describe, expect, test } from "vitest";
import { dispatchCommittedOutboxJob } from "../../src/server/integrations/outbox/dispatch-router";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher } from "../../src/server/integrations/outbox/dispatch-port";
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
});
