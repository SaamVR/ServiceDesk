import { describe, expect, test } from "vitest";
import { validateResolvedOutboxJob } from "../../src/server/integrations/outbox/intent-resolver";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";
import type { OutboxJob } from "../../src/server/integrations/types";

const event: ClaimedOutboxEvent = { id: "evt-1", workspaceId: "ws-1", topic: "outbox.whatsapp", payload: {}, idempotencyKey: "idem-1", attempt: 1, claimedAt: "2026-10-04T13:50:00.000Z" };
const job: OutboxJob = { id: "evt-1", workspaceId: "ws-1", channel: "WHATSAPP", purpose: "CONFIRMATION", recipient: { recipientRef: "+15555550123", consentRequired: false, hasOptIn: true, optedOut: false }, createdAt: event.claimedAt, idempotencyKey: "idem-1", payload: {} };

describe("outbox intent resolver validation", () => {
  test("accepts matching resolved outbox job", () => { expect(validateResolvedOutboxJob(event, job)).toEqual({ ok: true, value: job }); });
  test("fails closed on identity mismatch before provider call", () => { expect(validateResolvedOutboxJob(event, { ...job, workspaceId: "ws-2" })).toEqual({ ok: false, code: "OUTBOX_INTENT_WORKSPACE_MISMATCH", message: expect.any(String) }); });
  test("requires recipient reference", () => { expect(validateResolvedOutboxJob(event, { ...job, recipient: { ...job.recipient, recipientRef: " " } })).toEqual({ ok: false, code: "OUTBOX_INTENT_RECIPIENT_MISSING", message: expect.any(String) }); });
});
