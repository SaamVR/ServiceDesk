import { describe, expect, it, vi } from "vitest";
import { createPostgresCommercialProfitabilityReader } from "../../src/server/core/commercial-profitability-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const ctx = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };

function row(overrides: Record<string, unknown> = {}) {
  return {
    siteId: "site-1",
    siteCode: "HQ",
    serviceId: "service-1",
    serviceCode: "CLEAN",
    serviceName: "Cleaning",
    currency: "USD",
    quotedVisitCount: 4,
    completedVisitCount: 3,
    paidVisitCount: 2,
    unresolvedRateCount: 0,
    estimatedCostedVisitCount: 3,
    actualCostedCompletedVisitCount: 2,
    actualCostedPaidVisitCount: 2,
    partialPaymentVisitCount: 1,
    quotedRevenueMinor: 40000,
    completedRevenueMinor: 30000,
    paidRevenueMinor: 20000,
    recordedEstimatedCostMinor: 12000,
    recordedActualCompletedCostMinor: 11000,
    recordedActualPaidCostMinor: 7000,
    recordedQuotedMarginMinor: 28000,
    recordedCompletedMarginMinor: 19000,
    recordedPaidMarginMinor: 13000,
    ...overrides,
  };
}

describe("commercial profitability postgres boundary", () => {
  it("maps recorded site/service margins and exclusions", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "workspace-1",
          fromDate: "2026-10-01",
          toDate: "2026-10-31",
          rows: [row()],
          unattributedAdjustments: [{
            currency: "USD",
            finalizedNetMinor: -1500,
            paidNetMinor: -1500,
            lineCount: 1,
          }],
          partialPaymentInvoiceCount: 1,
        },
      },
      error: null,
    });
    const reader = createPostgresCommercialProfitabilityReader({ rpc } as SupabaseRpcClient);
    const result = await reader.readCommercialProfitabilitySnapshot(ctx, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        rows: [{
          siteCode: "HQ",
          serviceCode: "CLEAN",
          recordedPaidMarginMinor: 13000,
          partialPaymentVisitCount: 1,
        }],
        unattributedAdjustments: [{ lineCount: 1 }],
        partialPaymentInvoiceCount: 1,
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "servicedesk_read_commercial_profitability_snapshot",
      { p_input: expect.objectContaining({ workspaceId: "workspace-1", fromDate: "2026-10-01" }) },
    );
  });

  it("rejects a cross-workspace snapshot", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "other-workspace",
          rows: [],
          unattributedAdjustments: [],
          partialPaymentInvoiceCount: 0,
        },
      },
      error: null,
    });
    const reader = createPostgresCommercialProfitabilityReader({ rpc } as SupabaseRpcClient);
    const result = await reader.readCommercialProfitabilitySnapshot(ctx);

    expect(result).toMatchObject({ ok: false, code: "COMMERCIAL_PROFITABILITY_READ_MALFORMED" });
  });

  it("blocks crew access before the database call", async () => {
    const rpc = vi.fn();
    const reader = createPostgresCommercialProfitabilityReader({ rpc } as SupabaseRpcClient);
    const result = await reader.readCommercialProfitabilitySnapshot({
      workspaceId: "workspace-1",
      userId: "crew-1",
      role: "CREW",
    });

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
