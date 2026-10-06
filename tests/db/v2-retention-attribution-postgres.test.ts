import { describe, expect, it, vi } from "vitest";
import { createPostgresRetentionAttributionPort } from "../../src/server/core/retention-attribution-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const owner = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };
const dispatcher = { workspaceId: "workspace-1", userId: "dispatcher-1", role: "DISPATCHER" as const };

describe("retention attribution postgres boundary", () => {
  it("maps referral-to-paid-job summary without inventing conversion claims", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
        rows: [{
          referralCodeId: "ref-1",
          code: "NEIGHBOR10",
          label: "Neighbor referral",
          active: true,
          touchCount: 12,
          paidJobCount: 4,
          firstTouchAt: "2026-09-02T00:00:00.000Z",
          lastTouchAt: "2026-09-29T00:00:00.000Z",
        }],
        disclosure: "Attribution is directional, not perfect. First and last touch are frozen when the invoice first becomes PAID.",
      },
      error: null,
    });
    const port = createPostgresRetentionAttributionPort({ rpc } as SupabaseRpcClient);
    await expect(port.readReferralAttribution(dispatcher, {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    })).resolves.toMatchObject({
      ok: true,
      value: { rows: [{ code: "NEIGHBOR10", touchCount: 12, paidJobCount: 4 }] },
    });
  });

  it("keeps referral-code mutation owner-only before RPC execution", async () => {
    const rpc = vi.fn();
    const port = createPostgresRetentionAttributionPort({ rpc } as SupabaseRpcClient);
    await expect(port.upsertReferralCode(dispatcher, {
      code: "TEST",
      label: "Test",
      active: true,
      now: "2026-10-07T00:00:00.000Z",
    })).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes owner referral-code changes through the authoritative RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, referralCodeId: "ref-1", code: "NEIGHBOR10", active: true },
      error: null,
    });
    const port = createPostgresRetentionAttributionPort({ rpc } as SupabaseRpcClient);
    await expect(port.upsertReferralCode(owner, {
      code: "neighbor10",
      label: "Neighbor referral",
      active: true,
      now: "2026-10-07T00:00:00.000Z",
    })).resolves.toMatchObject({ ok: true, value: { referralCodeId: "ref-1", code: "NEIGHBOR10" } });
    expect(rpc).toHaveBeenCalledWith("servicedesk_upsert_referral_code", {
      p_input: expect.objectContaining({ workspaceId: "workspace-1", actorRole: "OWNER" }),
    });
  });
});
