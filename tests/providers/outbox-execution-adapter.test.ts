import { describe, expect, test } from "vitest";
import { ConnectorOutboxExecutionPort } from "../../src/server/integrations/outbox/execution-adapter";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";
import type { OutboxJob } from "../../src/server/integrations/types";

const now = () => "2026-10-04T13:50:00.000Z";
const event: ClaimedOutboxEvent = { id: "evt-1", workspaceId: "ws-1", topic: "outbox.whatsapp", payload: {}, idempotencyKey: "idem-1", attempt: 1, claimedAt: now() };
const job: OutboxJob = { id: "evt-1", workspaceId: "ws-1", channel: "WHATSAPP", purpose: "CONFIRMATION", recipient: { recipientRef: "+15555550123", consentRequired: false, hasOptIn: true, optedOut: false }, createdAt: now(), idempotencyKey: "idem-1", payload: {} };

describe("connector outbox execution port", () => {
  test("maps accepted dispatch to SENT with providerReference", async () => {
    const port = new ConnectorOutboxExecutionPort({ now, resolver: { async resolve() { return { ok: true, value: job }; } }, dispatchers: { WHATSAPP: { async dispatch() { return { ok: true, value: { outcome: "ACCEPTED", jobId: job.id, workspaceId: job.workspaceId, channel: job.channel, purpose: job.purpose, idempotencyKey: job.idempotencyKey, providerMessageId: "wamid-1", acceptedAt: now(), providerMode: "SANDBOX", evidence: { provider: "WHATSAPP", mode: "SANDBOX", verification: "CONTRACT_TESTED", capturedAt: now(), notes: [] } } }; } } } });
    await expect(port.execute(event)).resolves.toEqual({ ok: true, value: { outcome: "SENT", completedAt: now(), providerReference: "wamid-1" } });
  });

  test("does not call provider on resolver mismatch", async () => {
    let called = false;
    const port = new ConnectorOutboxExecutionPort({ now, resolver: { async resolve() { return { ok: true, value: { ...job, idempotencyKey: "wrong" } }; } }, dispatchers: { WHATSAPP: { async dispatch() { called = true; throw new Error("should not call"); } } } });
    const result = await port.execute(event);
    expect(result).toEqual({ ok: true, value: { outcome: "TERMINAL_FAILURE", failedAt: now(), code: "OUTBOX_INTENT_IDEMPOTENCY_MISMATCH" } });
    expect(called).toBe(false);
  });
});
