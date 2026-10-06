import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/contracts";
import { createPostgresCommercialPortfolioReader } from "../../src/server/core/commercial-read-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const owner: ActorContext = { userId: "owner_1", workspaceId: "ws_1", role: "OWNER" };

function baseSnapshot() {
  return {
    workspaceId: "ws_1",
    feature: { workspaceId: "ws_1", featureKey: "COMMERCIAL_OPERATIONS", enabled: true, config: {}, version: 1, updatedAt: "2026-10-06T00:00:00.000Z" },
    organizations: [{ id: "org_1", workspaceId: "ws_1", displayName: "Portfolio One", status: "ACTIVE", version: 1, createdAt: "2026-10-06T00:00:00.000Z", updatedAt: "2026-10-06T00:00:00.000Z" }],
    contacts: [], sites: [], contracts: [], contractVersions: [], contractSites: [], servicePlans: [], exceptionCases: [],
  };
}

function client(data: Record<string, unknown>): SupabaseRpcClient {
  return {
    async rpc<T = unknown>() {
      return { data: data as T, error: null };
    },
  };
}

describe("Postgres commercial portfolio reader", () => {
  it("maps a feature-enabled staff snapshot", async () => {
    const reader = createPostgresCommercialPortfolioReader(client({ ok: true, snapshot: baseSnapshot() }));
    const result = await reader.readCommercialPortfolioSnapshot(owner);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.organizations[0]?.displayName).toBe("Portfolio One");
      expect(result.value.feature.enabled).toBe(true);
    }
  });

  it("rejects non-owner/dispatcher actors before the RPC boundary", async () => {
    let called = false;
    const rpcClient: SupabaseRpcClient = {
      async rpc<T = unknown>() {
        called = true;
        return { data: null as T | null, error: null };
      },
    };
    const reader = createPostgresCommercialPortfolioReader(rpcClient);
    const result = await reader.readCommercialPortfolioSnapshot({ userId: "crew_1", workspaceId: "ws_1", role: "CREW" });
    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Owner or dispatcher access is required for commercial operations." });
    expect(called).toBe(false);
  });

  it("preserves explicit disabled-feature rejection from the database", async () => {
    const reader = createPostgresCommercialPortfolioReader(client({ ok: false, code: "COMMERCIAL_FEATURE_DISABLED" }));
    const result = await reader.readCommercialPortfolioSnapshot(owner);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("COMMERCIAL_FEATURE_DISABLED");
  });

  it("fails closed on cross-workspace rows", async () => {
    const snapshot = baseSnapshot();
    snapshot.organizations[0]!.workspaceId = "ws_other";
    const reader = createPostgresCommercialPortfolioReader(client({ ok: true, snapshot }));
    const result = await reader.readCommercialPortfolioSnapshot(owner);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COMMERCIAL_READ_MALFORMED");
      expect(result.message).toContain("cross-workspace");
    }
  });
});
