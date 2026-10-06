import { describe, expect, it, vi } from "vitest";
import { createRetentionCampaignIntentResolver } from "../../src/server/integrations/outbox/retention-campaign-intent";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const event = {
  id: "event-1",
  workspaceId: "workspace-1",
  topic: "retention.campaign",
  payload: {
    campaignId: "campaign-1",
    customerId: "customer-1",
    channel: "EMAIL",
  },
  idempotencyKey: "campaign:event-1",
  attempt: 1,
  claimedAt: "2026-10-07T00:00:00.000Z",
};

describe("retention campaign outbox intent", () => {
  it("resolves recipient and content from authoritative database state, not the queued payload", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        allowed: true,
        eventId: "event-1",
        workspaceId: "workspace-1",
        campaignId: "campaign-1",
        customerId: "customer-1",
        channel: "EMAIL",
        campaignPurpose: "FOLLOW_UP",
        recipientRef: "verified@example.test",
        templateKey: "follow-up-v1",
        subject: "How did we do?",
        text: "Thanks for choosing us.",
        html: "<p>Thanks for choosing us.</p>",
        idempotencyKey: "campaign:event-1",
      },
      error: null,
    });
    const resolver = createRetentionCampaignIntentResolver(
      { rpc } as SupabaseRpcClient,
      () => "2026-10-07T00:01:00.000Z",
    );
    await expect(resolver.resolve(event)).resolves.toMatchObject({
      ok: true,
      value: {
        channel: "EMAIL",
        purpose: "RETENTION_CAMPAIGN",
        recipient: {
          recipientRef: "verified@example.test",
          consentRequired: true,
          hasOptIn: true,
          optedOut: false,
        },
        payload: {
          email: { to: "verified@example.test", subject: "How did we do?" },
        },
      },
    });
    expect(JSON.stringify(event.payload)).not.toContain("verified@example.test");
  });

  it("fails closed when dispatch-time database eligibility is no longer allowed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, allowed: false, code: "RECIPIENT_OPTED_OUT" },
      error: null,
    });
    const resolver = createRetentionCampaignIntentResolver({ rpc } as SupabaseRpcClient);
    await expect(resolver.resolve(event)).resolves.toMatchObject({
      ok: false,
      code: "RECIPIENT_OPTED_OUT",
    });
  });

  it("rejects resolved identity that does not match queued campaign identifiers", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        allowed: true,
        eventId: "event-1",
        workspaceId: "workspace-1",
        campaignId: "different-campaign",
        customerId: "customer-1",
        channel: "EMAIL",
        campaignPurpose: "FOLLOW_UP",
        recipientRef: "verified@example.test",
        subject: "Subject",
        text: "Text",
        html: "<p>Text</p>",
        idempotencyKey: "campaign:event-1",
      },
      error: null,
    });
    const resolver = createRetentionCampaignIntentResolver({ rpc } as SupabaseRpcClient);
    await expect(resolver.resolve(event)).resolves.toMatchObject({
      ok: false,
      code: "RETENTION_INTENT_PAYLOAD_MISMATCH",
    });
  });
});
