import { describe, expect, it, vi } from "vitest";
import { createPostgresAccountingReconciliationReader } from "../../src/server/core/accounting-reconciliation-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const ctx = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };

describe("accounting backfill postgres boundary", () => {
  it("maps a dry-run plan with candidate and review counts", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        plan: {
          workspaceId: "workspace-1",
          provider: "example_accounting",
          dryRun: true,
          candidateCount: 2,
          blockedCount: 1,
          pendingCount: 3,
          currentCount: 7,
          candidates: [
            {
              entityType: "INVOICE",
              localResourceKind: "INVOICE",
              localResourceId: "invoice-1",
              localVersion: 3,
              reason: "LOCAL_VERSION_ADVANCED",
            },
            {
              entityType: "CONTACT",
              localResourceKind: "COMMERCIAL_ORGANIZATION",
              localResourceId: "org-1",
              localVersion: 1,
              reason: "UNTRACKED",
            },
          ],
        },
      },
      error: null,
    });
    const reader = createPostgresAccountingReconciliationReader({ rpc } as SupabaseRpcClient);
    const result = await reader.planAccountingBackfill(ctx, "example_accounting", 100);

    expect(result).toMatchObject({
      ok: true,
      value: {
        dryRun: true,
        candidateCount: 2,
        blockedCount: 1,
        candidates: [
          { localResourceKind: "INVOICE", reason: "LOCAL_VERSION_ADVANCED" },
          { localResourceKind: "COMMERCIAL_ORGANIZATION", reason: "UNTRACKED" },
        ],
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "servicedesk_plan_accounting_backfill",
      { p_input: expect.objectContaining({ workspaceId: "workspace-1", provider: "example_accounting", limit: 100 }) },
    );
  });

  it("rejects non-dry-run or cross-provider planner payloads", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        plan: {
          workspaceId: "workspace-1",
          provider: "other_provider",
          dryRun: false,
          candidateCount: 0,
          blockedCount: 0,
          pendingCount: 0,
          currentCount: 0,
          candidates: [],
        },
      },
      error: null,
    });
    const reader = createPostgresAccountingReconciliationReader({ rpc } as SupabaseRpcClient);
    const result = await reader.planAccountingBackfill(ctx, "example_accounting", 100);

    expect(result).toMatchObject({ ok: false, code: "ACCOUNTING_BACKFILL_READ_MALFORMED" });
  });

  it("blocks invalid provider or limit before an RPC call", async () => {
    const rpc = vi.fn();
    const reader = createPostgresAccountingReconciliationReader({ rpc } as SupabaseRpcClient);

    const providerResult = await reader.planAccountingBackfill(ctx, "Bad Provider", 100);
    const limitResult = await reader.planAccountingBackfill(ctx, "example_accounting", 501);

    expect(providerResult).toMatchObject({ ok: false, code: "ACCOUNTING_BACKFILL_INPUT_INVALID" });
    expect(limitResult).toMatchObject({ ok: false, code: "ACCOUNTING_BACKFILL_INPUT_INVALID" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
