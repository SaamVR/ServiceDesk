import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultRateCard } from "../../src/domain/quote";
import { createPostgresRequestQuoteCapacityFacadeMethods } from "../../src/server/core/request-quote-capacity-postgres";
import { loadOperationalQuoteRateCard, parsePersistedQuoteRateCard } from "../../src/server/core/operational-quote-rate-card";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branch = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const service = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const card = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const rate = {
  version: "owner-clean-2026-v1",
  currency: "USD", deposit_percent: 25, valid_hours: 48,
  buffer_minutes: 30, active: true,
  rules: {
    autoApprovalMaxTotalMinor: 50_000,
    moveOut: defaultRateCard.moveOut,
    standard: defaultRateCard.standard,
    deep: defaultRateCard.deep,
  },
};

function fakeDb(options: { noBook?: boolean; badRates?: boolean; inactiveService?: boolean; otherTenant?: boolean;
  branchCurrency?: string; cardCurrency?: string; inactiveBranch?: boolean; missingBranch?: boolean; foreignBranch?: boolean } = {}) {
  const calls: Array<{ table: string; filters: [string, unknown][] }> = [];
  const tables: Record<string, Record<string, unknown>[]> = {
    requests: [{ id: request, workspace_id: workspace, branch_id: branch, service_id: service }],
    workspace_branches: options.missingBranch ? [] : [{
      id: branch, workspace_id: options.foreignBranch ? "foreign-workspace" : workspace,
      currency: options.branchCurrency ?? "USD", active: !options.inactiveBranch,
    }],
    service_catalog: [{ id: service, workspace_id: options.otherTenant ? "foreign-ws" : workspace, active: !options.inactiveService, code: "MOVE_OUT" }],
    branch_price_books: options.noBook ? [] : [{ workspace_id: workspace, branch_id: branch, rate_card_id: card, active: true, starts_at: null, ends_at: null }],
    rate_cards: [{ id: card, workspace_id: workspace, ...rate,
      currency: options.cardCurrency ?? rate.currency,
      rules: options.badRates ? { ...rate.rules, standard: { baseMinor: -90 } } : rate.rules }],
  };
  const db = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      calls.push({ table, filters });
      const rows = () => (tables[table] || []).filter(row => filters.every(([key, value]) => row[key] === value));
      const chain = {
        select() { return chain; },
        eq(key: string, value: unknown) { filters.push([key, value]); return chain; },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        limit: async (n: number) => ({ data: rows().slice(0, n), error: null }),
      };
      return chain;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

describe("V4 real tenant quote pricing", () => {
  it("loads a real branch-bound rate card and never chooses synthetic pricing", async () => {
    const t = fakeDb();
    const result = await loadOperationalQuoteRateCard(t.db, workspace, request);
    expect(result).toMatchObject({ ok: true, value: { version: "owner-clean-2026-v1", currency: "USD" } });
    expect(t.calls.map(call => call.table)).toEqual(["requests", "workspace_branches", "service_catalog", "branch_price_books", "rate_cards"]);
    for (const call of t.calls) expect(call.filters).toContainEqual(["workspace_id", workspace]);
    expect(t.calls.find(c => c.table === "branch_price_books")?.filters).toContainEqual(["branch_id", branch]);
  });

  it("fails closed without a current branch price book, an active service or valid rates", async () => {
    for (const options of [{ noBook: true }, { inactiveService: true }, { badRates: true }, { otherTenant: true }]) {
      const t = fakeDb(options);
      const result = await loadOperationalQuoteRateCard(t.db, workspace, request);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a mismatched branch/card currency, disabled branch, and foreign branch without quoting", async () => {
    const scenarios = [
      [{ cardCurrency: "GBP" }, "QUOTE_RATE_BRANCH_CURRENCY_MISMATCH"],
      [{ branchCurrency: "GBP" }, "QUOTE_RATE_BRANCH_CURRENCY_MISMATCH"],
      [{ branchCurrency: "usd" }, "QUOTE_RATE_BRANCH_CURRENCY_INVALID"],
      [{ inactiveBranch: true }, "QUOTE_RATE_BRANCH_INACTIVE"],
      [{ missingBranch: true }, "QUOTE_RATE_BRANCH_INACTIVE"],
      [{ foreignBranch: true }, "QUOTE_RATE_BRANCH_INACTIVE"],
    ] as const;
    for (const [options, code] of scenarios) {
      const t = fakeDb(options);
      const result = await loadOperationalQuoteRateCard(t.db, workspace, request);
      expect(result).toMatchObject({ ok: false, code });
      expect(t.calls.find(x => x.table === "workspace_branches")?.filters)
        .toEqual([["workspace_id", workspace], ["id", branch]]);
    }
  });

  it("accepts a matching active GBP branch and explicitly GBP-denominated card without converting or inventing FX", async () => {
    const t = fakeDb({ branchCurrency: "GBP", cardCurrency: "GBP" });
    expect(await loadOperationalQuoteRateCard(t.db, workspace, request))
      .toMatchObject({ ok: true, value: { currency: "GBP" } });
  });

  it("rejects misleading synthetic rate versions, malformed prices and non-USD-tied currencies", () => {
    expect(parsePersistedQuoteRateCard({ ...rate, version: "synthetic-cleaning-v1" }))
      .toMatchObject({ ok: false, code: "QUOTE_RATE_CARD_INVALID" });
    expect(parsePersistedQuoteRateCard({ ...rate, rules: { ...rate.rules, deep: { baseMinor: -100 } } }))
      .toMatchObject({ ok: false });
    expect(parsePersistedQuoteRateCard({ ...rate, currency: "USD; DROP" }))
      .toMatchObject({ ok: false });
  });

  it("refuses to generate a real quote without a rate card before any persistence RPC", async () => {
    const rpc = vi.fn();
    const facade = createPostgresRequestQuoteCapacityFacadeMethods({ rpc } as unknown as SupabaseRpcClient);
    const ctx = { workspaceId: workspace, userId: "owner-id", role: "OWNER" as const };
    expect(await facade.calculateQuote(ctx, request))
      .toMatchObject({ ok: false, code: "QUOTE_RATE_CARD_REQUIRED" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("never adds an unselected oven charge when persisting a real move-out quote", async () => {
    const savedSnapshots: Record<string, unknown>[] = [];
    const rpc = vi.fn(async (name: string, params?: { p_input?: Record<string, unknown> }) => {
      if (name === "servicedesk_get_request") {
        return { data: { ok: true, request: {
          id: request, workspaceId: workspace, status: "READY", serviceCode: "MOVE_OUT",
          bedrooms: 3, bathrooms: 2, version: 1,
          createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T00:00:00Z",
        } }, error: null };
      }
      if (name === "servicedesk_persist_quote_snapshot") {
        const snapshot = params?.p_input?.snapshot as Record<string, unknown>;
        savedSnapshots.push(snapshot);
        return { data: { ok: true, quote: snapshot }, error: null };
      }
      return { data: null, error: { code: "UNEXPECTED_RPC", message: "Unexpected RPC" } };
    });
    const facade = createPostgresRequestQuoteCapacityFacadeMethods(
      { rpc } as unknown as SupabaseRpcClient,
      { ...defaultRateCard, version: "real-owner-approved-fixture-v1" },
    );
    const result = await facade.calculateQuote({ workspaceId: workspace, userId: "confirmed-owner", role: "OWNER" }, request);
    expect(result).toMatchObject({ ok: true, value: { subtotalMinor: 31000, depositMinor: 7750, durationMinutes: 210 } });
    expect(savedSnapshots).toHaveLength(1);
    expect(savedSnapshots[0].lineItems).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "OVEN" }),
    ]));
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("honors a separately staff-confirmed oven add-on only for persisted MOVE_OUT", async () => {
    for (const serviceCode of ["MOVE_OUT", "STANDARD"] as const) {
      let saved: Record<string, unknown> | undefined;
      const rpc = vi.fn(async (method: string, params?: { p_input?: Record<string, unknown> }) => {
        if (method === "servicedesk_get_request") return { data: { ok: true, request: {
          id: request, workspaceId: workspace, serviceCode,
          status: "READY", bedrooms: 3, bathrooms: 2, version: 1,
          createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T00:00:00Z",
        } }, error: null };
        if (method === "servicedesk_persist_quote_snapshot") {
          saved = params?.p_input?.snapshot as Record<string, unknown>;
          return { data: { ok: true, quote: saved }, error: null };
        }
        return { data: null, error: { message: "Unexpected RPC" } };
      });
      const facade = createPostgresRequestQuoteCapacityFacadeMethods(
        { rpc } as unknown as SupabaseRpcClient,
        { ...defaultRateCard, version: "fixture-of-owner-configured-rates" },
        { oven: true },
      );
      const result = await facade.calculateQuote(
        { workspaceId: workspace, userId: "owner-auth", role: "OWNER" }, request);
      expect(result).toMatchObject({ ok: true, value: {
        totalMinor: serviceCode === "MOVE_OUT" ? 34000 : 19000,
      } });
      const items = saved?.lineItems as Array<{ code: string }> | undefined;
      expect(items?.some(item => item.code === "OVEN")).toBe(serviceCode === "MOVE_OUT");
      expect(rpc).toHaveBeenCalledTimes(2);
    }
  });

});
