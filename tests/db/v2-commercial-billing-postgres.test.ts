import { describe, expect, it, vi } from "vitest";
import { createPostgresCommercialBillingCommands } from "../../src/server/core/commercial-billing-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const ctx = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-1",
    workspaceId: "workspace-1",
    organizationId: "org-1",
    contractId: "contract-1",
    contractVersionId: "version-1",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    state: "DRAFT",
    currency: "USD",
    chargeMinor: 25000,
    creditMinor: 0,
    netTotalMinor: 25000,
    version: 1,
    createdAt: "2026-10-31T00:00:00.000Z",
    updatedAt: "2026-10-31T00:00:00.000Z",
    lines: [{
      id: "line-1",
      workspaceId: "workspace-1",
      draftId: "draft-1",
      sourceType: "VISIT",
      visitId: "visit-1",
      direction: "CHARGE",
      amountMinor: 25000,
      currency: "USD",
      state: "INCLUDED",
      descriptionSnapshot: { billingModel: "FIXED_PER_VISIT" },
      createdAt: "2026-10-31T00:00:00.000Z",
      updatedAt: "2026-10-31T00:00:00.000Z",
    }],
    ...overrides,
  };
}

describe("commercial billing postgres commands", () => {
  it("creates a period draft through the authoritative RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, duplicate: false, draft: draft() }, error: null });
    const commands = createPostgresCommercialBillingCommands({ rpc } as SupabaseRpcClient);
    const result = await commands.createCommercialBillingDraft(ctx, {
      contractVersionId: "version-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      now: "2026-10-31T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("servicedesk_create_commercial_billing_draft", {
      p_input: expect.objectContaining({ workspaceId: "workspace-1", contractVersionId: "version-1" }),
    });
  });

  it("rejects cross-workspace data returned by the database boundary", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, duplicate: false, draft: draft({ workspaceId: "other-workspace" }) },
      error: null,
    });
    const commands = createPostgresCommercialBillingCommands({ rpc } as SupabaseRpcClient);
    const result = await commands.createCommercialBillingDraft(ctx, {
      contractVersionId: "version-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      now: "2026-10-31T00:00:00.000Z",
    });

    expect(result).toMatchObject({ ok: false, code: "COMMERCIAL_BILLING_RPC_MALFORMED" });
  });

  it("finalizes into the ordinary invoice shape without synthesizing payment state", async () => {
    const finalized = draft({ state: "FINALIZED", invoiceId: "invoice-1", version: 2 });
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        duplicate: false,
        draft: finalized,
        invoice: {
          id: "invoice-1",
          workspaceId: "workspace-1",
          status: "ISSUED",
          currency: "USD",
          totalMinor: 25000,
          allocatedMinor: 0,
          refundedMinor: 0,
          balanceMinor: 25000,
        },
      },
      error: null,
    });
    const commands = createPostgresCommercialBillingCommands({ rpc } as SupabaseRpcClient);
    const result = await commands.finalizeCommercialBillingDraft(ctx, {
      draftId: "draft-1",
      expectedVersion: 1,
      now: "2026-10-31T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { invoice: { status: "ISSUED", allocatedMinor: 0, balanceMinor: 25000 } },
    });
  });

  it("blocks crew actors before any billing RPC is called", async () => {
    const rpc = vi.fn();
    const commands = createPostgresCommercialBillingCommands({ rpc } as SupabaseRpcClient);
    const result = await commands.finalizeCommercialBillingDraft(
      { workspaceId: "workspace-1", userId: "crew-1", role: "CREW" },
      { draftId: "draft-1", expectedVersion: 1, now: "2026-10-31T00:00:00.000Z" },
    );

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
