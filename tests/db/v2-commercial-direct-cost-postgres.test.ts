import { describe, expect, it, vi } from "vitest";
import { createPostgresCommercialDirectCostPort } from "../../src/server/core/commercial-direct-cost-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const ctx = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "cost-1",
    workspaceId: "workspace-1",
    visitId: "visit-1",
    contractVersionId: "contract-version-1",
    siteId: "site-1",
    serviceId: "service-1",
    category: "LABOR",
    basis: "ACTUAL",
    direction: "COST",
    amountMinor: 12500,
    currency: "USD",
    sourceKind: "MANUAL",
    occurredAt: "2026-10-06T02:00:00.000Z",
    createdAt: "2026-10-06T02:01:00.000Z",
    ...overrides,
  };
}

describe("commercial direct cost postgres boundary", () => {
  it("maps a cost snapshot with net grouped totals", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "workspace-1",
          entries: [entry()],
          totals: [{ currency: "USD", category: "LABOR", basis: "ACTUAL", netMinor: 12500 }],
        },
      },
      error: null,
    });
    const port = createPostgresCommercialDirectCostPort({ rpc } as SupabaseRpcClient);
    const result = await port.readCommercialDirectCostSnapshot(ctx);

    expect(result).toMatchObject({
      ok: true,
      value: {
        workspaceId: "workspace-1",
        entries: [{ category: "LABOR", basis: "ACTUAL", amountMinor: 12500 }],
        totals: [{ currency: "USD", netMinor: 12500 }],
      },
    });
  });

  it("rejects cross-workspace cost rows", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "workspace-1",
          entries: [entry({ workspaceId: "other-workspace" })],
          totals: [],
        },
      },
      error: null,
    });
    const port = createPostgresCommercialDirectCostPort({ rpc } as SupabaseRpcClient);
    const result = await port.readCommercialDirectCostSnapshot(ctx);

    expect(result).toMatchObject({ ok: false, code: "COMMERCIAL_DIRECT_COST_READ_MALFORMED" });
  });

  it("records an idempotent direct cost through the authoritative RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, duplicate: true, entry: entry() },
      error: null,
    });
    const port = createPostgresCommercialDirectCostPort({ rpc } as SupabaseRpcClient);
    const result = await port.recordCommercialDirectCost(ctx, {
      visitId: "visit-1",
      category: "LABOR",
      basis: "ACTUAL",
      direction: "COST",
      amountMinor: 12500,
      currency: "USD",
      sourceKind: "MANUAL",
      idempotencyKey: "direct-cost:visit-1:labor",
      occurredAt: "2026-10-06T02:00:00.000Z",
      now: "2026-10-06T02:01:00.000Z",
    });

    expect(result).toMatchObject({ ok: true, value: { duplicate: true, entry: { id: "cost-1" } } });
    expect(rpc).toHaveBeenCalledWith(
      "servicedesk_record_commercial_direct_cost",
      { p_input: expect.objectContaining({ workspaceId: "workspace-1", visitId: "visit-1" }) },
    );
  });

  it("rejects malformed reversal input before calling the database", async () => {
    const rpc = vi.fn();
    const port = createPostgresCommercialDirectCostPort({ rpc } as SupabaseRpcClient);
    const result = await port.recordCommercialDirectCost(ctx, {
      visitId: "visit-1",
      category: "TRAVEL",
      basis: "ACTUAL",
      direction: "REVERSAL",
      amountMinor: 2000,
      currency: "USD",
      sourceKind: "TRAVEL",
      idempotencyKey: "direct-cost:reversal:1",
      occurredAt: "2026-10-06T03:00:00.000Z",
      now: "2026-10-06T03:00:00.000Z",
    });

    expect(result).toMatchObject({ ok: false, code: "COMMERCIAL_DIRECT_COST_INPUT_INVALID" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks crew actors before direct cost reads or writes", async () => {
    const rpc = vi.fn();
    const port = createPostgresCommercialDirectCostPort({ rpc } as SupabaseRpcClient);
    const crew = { workspaceId: "workspace-1", userId: "crew-1", role: "CREW" as const };

    expect(await port.readCommercialDirectCostSnapshot(crew)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
