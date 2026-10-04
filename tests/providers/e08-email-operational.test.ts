import { describe, expect, test } from "vitest";
import { resolveAuthoritativeEmailOutboxIntent } from "../../src/server/integrations/outbox/email-intent";
import { createEmailCallbackReceiptStore } from "../../src/server/integrations/email/callback-receipt";
import { buildEmailCallbackCommands, processEmailProviderCallback } from "../../src/server/integrations/email/callback-bridge";
import type { ClaimedOutboxEvent } from "../../src/contracts/outbox";

const event: ClaimedOutboxEvent = {
  id: "outbox-email-1",
  workspaceId: "ws-1",
  topic: "email.invoice",
  payload: { to: "attacker@example.test", subject: "bad" },
  idempotencyKey: "idem-email-1",
  attempt: 1,
  claimedAt: "2026-10-04T17:20:00.000Z",
};

describe("E08 authoritative email and callbacks", () => {
  test("resolves provider email from authoritative source, not outbox payload", async () => {
    const resolved = await resolveAuthoritativeEmailOutboxIntent(event, {
      async resolve(claimed) {
        return {
          ok: true,
          value: {
            eventId: claimed.id,
            workspaceId: claimed.workspaceId,
            topic: "email.invoice",
            purpose: "INVOICE",
            idempotencyKey: claimed.idempotencyKey,
            recipient: { recipientRef: "cust-1", to: "customer@example.com", consentRequired: true, hasOptIn: true, optedOut: false },
            subject: "Invoice ready",
            text: "Your invoice is ready.",
            html: "<p>Your invoice is ready.</p>",
            templateKey: "invoice-ready",
          },
        };
      },
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.ok && resolved.value.payload.email).toMatchObject({ to: "customer@example.com", subject: "Invoice ready", authoritative: true });
    expect(JSON.stringify(resolved.ok && resolved.value.payload)).not.toContain("attacker@example.test");
  });

  test("emits delivered, bounce and complaint command shapes without direct Core mutation", async () => {
    const delivered = buildEmailCallbackCommands(undefined, {
      callbackKey: "cb-delivered",
      providerMessageId: "provider-msg-1",
      eventType: "DELIVERED",
      occurredAt: "2026-10-04T17:21:00.000Z",
      recipientRef: "customer@example.com",
    });
    expect(delivered.deliveryCommand).toMatchObject({ command: "UPDATE_MESSAGE_DELIVERY_STATE", deliveryState: "DELIVERED", providerAcceptedIsDelivered: false });

    const hardBounce = buildEmailCallbackCommands(undefined, {
      callbackKey: "cb-hard",
      providerMessageId: "provider-msg-1",
      eventType: "BOUNCE",
      bounceType: "hard",
      occurredAt: "2026-10-04T17:22:00.000Z",
      recipientRef: "customer@example.com",
    });
    expect(hardBounce.suppressionCommand).toMatchObject({ command: "REVIEW_OR_SUPPRESS_RECIPIENT", reason: "HARD_BOUNCE" });

    const complaint = buildEmailCallbackCommands(undefined, {
      callbackKey: "cb-complaint",
      providerMessageId: "provider-msg-1",
      eventType: "COMPLAINT",
      occurredAt: "2026-10-04T17:23:00.000Z",
      recipientRef: "customer@example.com",
    });
    expect(complaint.suppressionCommand).toMatchObject({ reason: "COMPLAINT" });
  });

  test("duplicate callback receipt still supports Core reconciliation after prior Core failure", async () => {
    const rows: string[] = ["cb-1"];
    const receiptStore = createEmailCallbackReceiptStore({
      async insertReceipt(row) {
        if (rows.includes(row.callbackKey)) return "DUPLICATE";
        rows.push(row.callbackKey);
        return "INSERTED";
      },
    });
    const applied: string[] = [];
    const result = await processEmailProviderCallback({
      receiptStore,
      event: {
        callbackKey: "cb-1",
        providerMessageId: "provider-msg-2",
        eventType: "DELIVERED",
        occurredAt: "2026-10-04T17:24:00.000Z",
        recipientRef: "customer@example.com",
      },
      core: {
        async applyDeliveryState(command) { applied.push(command.deliveryState); return { ok: true, value: "APPLIED" }; },
        async applySuppressionReview() { return { ok: true, value: "APPLIED" }; },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.receipt).toBe("DUPLICATE");
    expect(applied).toEqual(["DELIVERED"]);
  });
});
