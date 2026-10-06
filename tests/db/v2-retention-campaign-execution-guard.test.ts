import { describe, expect, it, vi } from "vitest";
import { createPostgresRetentionCampaignExecutionGuard } from "../../src/server/jobs/outbox-execution-guard";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const event = {
  id: "event-1",
  workspaceId: "workspace-1",
  topic: "retention.campaign",
  payload: { campaignId: "campaign-1", customerId: "customer-1", channel: "EMAIL" },
  idempotencyKey: "campaign:event-1",
  attempt: 1,
  claimedAt: "2026-10-07T00:00:00.000Z",
};

describe("retention campaign execution guard", () => {
  it("passes non-campaign outbox events without a database lookup", async () => {
    const rpc = vi.fn();
    const guard = createPostgresRetentionCampaignExecutionGuard({ rpc } as SupabaseRpcClient);
    await expect(guard.check({ ...event, topic: "email.invoice" }, event.claimedAt))
      .resolves.toEqual({ ok: true, value: { allowed: true } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns current database suppression truth for a claimed campaign event", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, allowed: false, code: "RECIPIENT_OPTED_OUT" },
      error: null,
    });
    const guard = createPostgresRetentionCampaignExecutionGuard({ rpc } as SupabaseRpcClient);
    await expect(guard.check(event, event.claimedAt)).resolves.toEqual({
      ok: true,
      value: { allowed: false, code: "RECIPIENT_OPTED_OUT" },
    });
    expect(rpc).toHaveBeenCalledWith(
      "servicedesk_check_retention_campaign_dispatch_eligibility",
      { p_input: { workspaceId: "workspace-1", eventId: "event-1", now: event.claimedAt } },
    );
  });

  it("fails closed when current eligibility cannot be verified", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "NETWORK", message: "database unavailable" },
    });
    const guard = createPostgresRetentionCampaignExecutionGuard({ rpc } as SupabaseRpcClient);
    await expect(guard.check(event, event.claimedAt)).resolves.toMatchObject({
      ok: false,
      code: "NETWORK",
    });
  });
});
