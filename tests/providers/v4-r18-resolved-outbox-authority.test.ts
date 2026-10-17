import { describe, expect, it } from "vitest";
import { validateResolvedOutboxJob } from "../../src/server/integrations/outbox/intent-resolver";
import { ConnectorOutboxExecutionPort } from "../../src/server/integrations/outbox/execution-adapter";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";
import type { OutboxJob } from "../../src/server/integrations/types";

const at = "2026-10-17T07:00:00.000Z";
const claim: ClaimedOutboxEvent = {
  id: "claim-a", workspaceId: "workspace-a", topic: "outbox.whatsapp",
  payload: {}, idempotencyKey: "idem-a", attempt: 1, claimedAt: at,
};
const valid: OutboxJob = {
  id: claim.id, workspaceId: claim.workspaceId, idempotencyKey: claim.idempotencyKey,
  channel: "WHATSAPP", purpose: "QUOTE", createdAt: at, payload: {},
  recipient: { recipientRef: "recipient-a", consentRequired: true, hasOptIn: true, optedOut: false },
};
const check = (job: unknown) => validateResolvedOutboxJob(claim, job as OutboxJob);

describe("R18 recovered outbox authority and safety", () => {
  it("retains valid internal resolution and explicitly typed opt-in policy", () => {
    expect(check(valid)).toEqual({ ok: true, value: valid });
    expect(check({ ...valid, recipient: { ...valid.recipient, quietHoursBlocked: true } }))
      .toMatchObject({ ok: true });
  });

  it("fails closed instead of throwing for missing job or recipient objects", () => {
    for (const job of [null, undefined, [], false, {}, 7]) {
      expect(check(job)).toMatchObject({ ok: false, code: "OUTBOX_INTENT_IDENTITY_INVALID" });
    }
    for (const recipient of [null, undefined, [], {}, 2, false, "recipient-a", " "]) {
      expect(check({ ...valid, recipient }), JSON.stringify(recipient))
        .toMatchObject({ ok: false, code: "OUTBOX_INTENT_RECIPIENT_MISSING" });
    }
  });

  it("rejects claimed tenant substitution, replay identity and unsupported intents", () => {
    expect(check({ ...valid, id: "other" }))
      .toMatchObject({ ok: false, code: "OUTBOX_INTENT_ID_MISMATCH" });
    expect(check({ ...valid, workspaceId: "workspace-b" }))
      .toMatchObject({ ok: false, code: "OUTBOX_INTENT_WORKSPACE_MISMATCH" });
    expect(check({ ...valid, idempotencyKey: "other" }))
      .toMatchObject({ ok: false, code: "OUTBOX_INTENT_IDEMPOTENCY_MISMATCH" });
    for (const key of ["\nrecipient", "  recipient", "recipient\u202e", "a".repeat(257)]) {
      expect(check({ ...valid, recipient: { ...valid.recipient, recipientRef: key } }))
        .toMatchObject({ ok: false, code: "OUTBOX_INTENT_RECIPIENT_INVALID" });
    }
    expect(check({ ...valid, channel: "PAYMENT" }))
      .toMatchObject({ ok: false, code: "OUTBOX_INTENT_CHANNEL_INVALID" });
    expect(check({ ...valid, purpose: "CHARGE_CARD" }))
      .toMatchObject({ ok: false, code: "OUTBOX_INTENT_PURPOSE_INVALID" });
  });

  it("rejects consent, payload and handover shape spoofing", () => {
    for (const recipient of [
      { ...valid.recipient, hasOptIn: "true" },
      { ...valid.recipient, optedOut: 0 },
      { ...valid.recipient, consentRequired: null },
      { ...valid.recipient, quietHoursBlocked: "false" },
      { ...valid.recipient, recipientRef: "\n" },
    ]) {
      expect(check({ ...valid, recipient })).toMatchObject({ ok: false });
    }
    for (const payload of [null, [], 3]) {
      expect(check({ ...valid, payload })).toMatchObject({ ok: false, code: "OUTBOX_INTENT_PAYLOAD_INVALID" });
    }
    for (const handoverGuard of [
      null, [], {}, { conversationId: "id", expectedConversationVersion: -1, handoverActive: false },
      { conversationId: "id", expectedConversationVersion: "1", handoverActive: false },
      { conversationId: "id", expectedConversationVersion: 1, handoverActive: "false" },
    ]) {
      expect(check({ ...valid, handoverGuard }))
        .toMatchObject({ ok: false, code: "OUTBOX_INTENT_HANDOVER_INVALID" });
    }
  });

  it("terminally rejects corrupt resolved recipients without invoking a provider", async () => {
    for (const recipient of [undefined, null, [], { recipientRef: "r", optedOut: false }]) {
      let sends = 0;
      const port = new ConnectorOutboxExecutionPort({
        now: () => at,
        resolver: { async resolve() {
          return { ok: true as const, value: { ...valid, recipient } as unknown as OutboxJob };
        } },
        dispatchers: { WHATSAPP: { async dispatch() {
          sends++;
          throw Error("PROVIDER_MUST_NOT_BE_CALLED");
        } } },
      });
      await expect(port.execute(claim)).resolves.toMatchObject({
        ok: true,
        value: { outcome: "TERMINAL_FAILURE", failedAt: at },
      });
      expect(sends).toBe(0);
    }
  });
});
