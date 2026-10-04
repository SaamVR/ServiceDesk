import { describe, expect, test } from "vitest";
import type { ActorContext, CommandMeta } from "../../src/contracts";
import type { OutboxJob } from "../../src/server/integrations/types";
import { prepareWhatsAppDispatch } from "../../src/server/integrations/whatsapp/outbound-policy";

const ctx: ActorContext = { workspaceId: "ws-clearnest", role: "DISPATCHER", userId: "staff-1" };
const meta: CommandMeta = { idempotencyKey: "cmd-1", now: "2026-10-04T10:00:00.000Z" };

function job(overrides: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: "job-1",
    workspaceId: "ws-clearnest",
    channel: "WHATSAPP",
    purpose: "QUOTE",
    recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: true, optedOut: false },
    createdAt: "2026-10-04T09:59:00.000Z",
    idempotencyKey: "outbox-job-1",
    freeformText: "Your quote is ready.",
    payload: { lastInboundAt: "2026-10-04T09:00:00.000Z" },
    ...overrides,
  };
}

describe("WhatsApp outbound dispatch policy", () => {
  test("prepares a dispatch without treating provider acceptance as delivery", () => {
    const prepared = prepareWhatsAppDispatch(ctx, job(), meta);

    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.value.dispatch.jobId).toBe("job-1");
      expect(prepared.value.dispatch.deliverySemantics).toBe("PROVIDER_ACCEPTANCE_ONLY");
      expect(prepared.value.dispatch.idempotencyKey).toBe("outbox-job-1");
      expect(prepared.value.policy.requiresTemplate).toBe(false);
    }
  });

  test("rejects cross-workspace dispatch before provider call", () => {
    const prepared = prepareWhatsAppDispatch(ctx, job({ workspaceId: "ws-other" }), meta);

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("WORKSPACE_MISMATCH");
  });

  test("suppresses opted-out or handover-active recipients", () => {
    const optedOut = prepareWhatsAppDispatch(ctx, job({ recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: true, optedOut: true } }), meta);
    const handover = prepareWhatsAppDispatch(
      ctx,
      job({ handoverGuard: { conversationId: "conv-1", expectedConversationVersion: 7, handoverActive: true } }),
      meta,
    );

    expect(optedOut.ok).toBe(false);
    if (!optedOut.ok) expect(optedOut.code).toBe("RECIPIENT_OPTED_OUT");
    expect(handover.ok).toBe(false);
    if (!handover.ok) expect(handover.code).toBe("HUMAN_HANDOVER_ACTIVE");
  });

  test("requires a template outside the customer-service window", () => {
    const outsideWindow = prepareWhatsAppDispatch(ctx, job({ payload: { lastInboundAt: "2026-10-01T09:00:00.000Z" } }), meta);
    const templated = prepareWhatsAppDispatch(ctx, job({ payload: { lastInboundAt: "2026-10-01T09:00:00.000Z" }, templateKey: "quote_ready_v1" }), meta);

    expect(outsideWindow.ok).toBe(false);
    if (!outsideWindow.ok) expect(outsideWindow.code).toBe("WHATSAPP_TEMPLATE_REQUIRED");
    expect(templated.ok).toBe(true);
  });

  test("does not let a future inbound timestamp open the customer-service window", () => {
    const futureInbound = prepareWhatsAppDispatch(
      ctx,
      job({ payload: { lastInboundAt: "2026-10-04T10:05:00.000Z" } }),
      meta,
    );

    expect(futureInbound.ok).toBe(false);
    if (!futureInbound.ok) expect(futureInbound.code).toBe("WHATSAPP_TEMPLATE_REQUIRED");
  });

  test("blocks freeform messages when inbound timestamp is invalid", () => {
    const prepared = prepareWhatsAppDispatch(ctx, job({ payload: { lastInboundAt: "not-a-date" } }), meta);

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("WHATSAPP_TEMPLATE_REQUIRED");
  });

  test("allows freeform message at exactly the 24-hour customer-service boundary", () => {
    const prepared = prepareWhatsAppDispatch(ctx, job({ payload: { lastInboundAt: "2026-10-03T10:00:00.000Z" } }), meta);

    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.value.policy.requiresTemplate).toBe(false);
      expect(prepared.value.dispatch.freeformText).toBe("Your quote is ready.");
    }
  });

  test("suppresses missing opt-in before provider call", () => {
    const prepared = prepareWhatsAppDispatch(
      ctx,
      job({ recipient: { recipientRef: "contact-1", consentRequired: true, hasOptIn: false, optedOut: false } }),
      meta,
    );

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("MISSING_OPT_IN");
  });

  test("requires outbox idempotency before provider call", () => {
    const prepared = prepareWhatsAppDispatch(ctx, job({ idempotencyKey: "" }), meta);

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("MISSING_IDEMPOTENCY_KEY");
  });

  test("rejects non-WhatsApp outbox jobs in the WhatsApp dispatcher", () => {
    const prepared = prepareWhatsAppDispatch(ctx, job({ channel: "EMAIL" }), meta);

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("WRONG_DELIVERY_CHANNEL");
  });
});
