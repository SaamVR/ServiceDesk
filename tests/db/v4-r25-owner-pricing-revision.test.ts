import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parseOwnerCleaningPricingSetup } from "../../src/server/core/owner-cleaning-pricing-input";
import {
  parsePricingRevisionExpected, loadAuthorizedOwnerPricingBooks,
  reviseAuthorizedCleaningPricing,
} from "../../src/server/core/owner-cleaning-pricing-revision";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const oldBookId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const newBookId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const rateId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const actorId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const revisionId = "12345678-1234-4234-8234-123456789abc";
const branch = { id: branchId, code: "HQ", name: "Owner branch", currency: "USD", timezone: "UTC", isDefault: true };

function form(): FormData {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    setupId: revisionId, branchId, currency: "USD", expectedBookId: oldBookId,
    expectedBookVersion: "7",
    nameStandard: "Standard cleaning", nameDeep: "Deep cleaning", nameMoveOut: "Move-out cleaning",
    depositPercent: "25", validHours: "48", bufferMinutes: "30", autoApprovalMax: "500",
  })) f.set(key, value);
  for (const type of ["standard","deep","moveOut"]) {
    for (const suffix of ["Base","Bedroom","Bathroom"]) {
      f.set(type+suffix, suffix === "Base" ? "90.00" : "15.00");
      f.set(type+suffix+"Minutes", suffix === "Base" ? "90" : "20");
    }
  }
  f.set("moveOutOven", "35.00"); f.set("moveOutOvenMinutes", "30");
  return f;
}
function actor(role = "OWNER", id = branchId, service: unknown = {}, rpc: unknown = {}) {
  return vi.fn(async () => ({
    ok: true,
    value: {
      workspace: { id: workspaceId, slug: "test-cleaning", name: "Test", timezone: "UTC", currency: "USD" },
      actor: { workspaceId, role, userId: actorId },
      branchScope: { mode: "ALL", branches: [{ ...branch, id }] },
      rpc, service,
    },
  })) as never;
}
function mockQuery(data: unknown) {
  const chain = {
    select: () => chain, eq: () => chain, in: () => chain, limit: () => chain,
    maybeSingle: async () => ({ data, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data, error: null })),
  };
  return chain;
}
function fakeService(results: Record<string, unknown>) {
  return { from: (table: string) => mockQuery(results[table]) };
}

describe("V4 owner price revision contract", () => {
  it("binds the expected active book and refuses stale or forged form versions", () => {
    const f = form();
    expect(parsePricingRevisionExpected(f)).toEqual({
      ok: true, value: { expectedBookId: oldBookId, expectedBookVersion: 7 },
    });
    for (const text of ["0", "-1", "1e3", "1.1", "1000000001"]) {
      f.set("expectedBookVersion", text);
      expect(parsePricingRevisionExpected(f).ok).toBe(false);
    }
    f.set("expectedBookVersion", "7"); f.set("expectedBookId", "foreign");
    expect(parsePricingRevisionExpected(f).ok).toBe(false);
  });

  it("refuses non-owner and foreign-branch revisions before calling SQL", async () => {
    const rpc = { rpc: vi.fn() };
    const denied = await reviseAuthorizedCleaningPricing("test-cleaning", form(), {
      mode: () => "SERVICE_ROLE", resolveActor: actor("DISPATCHER", branchId, {}, rpc),
    });
    expect(denied.ok).toBe(false);
    expect(rpc.rpc).not.toHaveBeenCalled();
    const foreign = await reviseAuthorizedCleaningPricing("test-cleaning", form(), {
      mode: () => "SERVICE_ROLE", resolveActor: actor("OWNER", newBookId, {}, rpc),
    });
    expect(foreign.ok).toBe(false);
    expect(rpc.rpc).not.toHaveBeenCalled();
  });

  it("blocks on confirmed stale version and on an unknown commit without claiming success", async () => {
    const stale = { rpc: vi.fn(async () => ({ data: {ok:false,code:"PRICING_REVISION_VERSION_CONFLICT"},error:null })) };
    const rejected = await reviseAuthorizedCleaningPricing("test-cleaning", form(), {
      mode: () => "SERVICE_ROLE", resolveActor: actor("OWNER", branchId, {}, stale),
    });
    expect(rejected).toMatchObject({ ok: false, code: "PRICING_REVISION_VERSION_CONFLICT" });
    const unknown = { rpc: vi.fn(async () => { throw new Error("network error"); }) };
    const response = await reviseAuthorizedCleaningPricing("test-cleaning", form(), {
      mode: () => "SERVICE_ROLE", resolveActor: actor("OWNER", branchId, {}, unknown),
    });
    expect(response).toMatchObject({ ok: false, code: "PRICING_REVISION_RPC_UNAVAILABLE" });
    if (!response.ok) expect(response.message).toContain("may have committed");
  });

  it("insists on one new active book, old inactive, exact new rules and real service names", async () => {
    const parsed = parseOwnerCleaningPricingSetup(form());
    if (!parsed.ok) throw new Error(parsed.message);
    const saved = { ok:true,duplicate:false,branchId,priceBookId:newBookId,rateCardId:rateId,
      rateVersion:"owner-cleaning-revision-"+revisionId };
    const rpc = { rpc: vi.fn(async () => ({ data:saved, error:null })) };
    const good = {
      branch_price_books: [{ id:newBookId, rate_card_id:rateId, branch_id:branchId,active:true }],
      rate_cards: { id:rateId, version:saved.rateVersion, active:true, currency:"USD",
        deposit_percent:25,valid_hours:48,buffer_minutes:30,rules:parsed.value.rules },
      service_catalog: Object.entries(parsed.value.serviceNames).map(([code,name])=>({code,name,active:true})),
    };
    // Table read of the old book is separate from active-book list.
    let calls=0;
    const service = { from: (table: string) => {
      if (table === "branch_price_books") {
        calls++;
        return mockQuery(calls === 1 ? good.branch_price_books : {id:oldBookId,active:false});
      }
      return mockQuery(good[table as "rate_cards" | "service_catalog"]);
    }};
    const outcome = await reviseAuthorizedCleaningPricing("test-cleaning", form(), {
      mode: () => "SERVICE_ROLE", resolveActor: actor("OWNER",branchId,service,rpc),
    });
    expect(outcome).toMatchObject({ok:true,value:{state:"PERSISTED_OWNER_PRICING_REVISION_VERIFIED",
      externalCustomerMessagesSent:0}});
    expect(rpc.rpc).toHaveBeenCalledTimes(1);
    expect(rpc.rpc.mock.calls[0][1].p_input).toMatchObject({
      expectedBookId:oldBookId,expectedBookVersion:7,branchId,workspaceId,actorUserId:actorId,
    });
    calls=0;
    const badService = {from: (table: string) =>
      mockQuery(table === "branch_price_books" ? [{...good.branch_price_books[0],active:false}] :
        good[table as "rate_cards" | "service_catalog"])};
    const noProof = await reviseAuthorizedCleaningPricing("test-cleaning", form(), {
      mode: () => "SERVICE_ROLE", resolveActor: actor("OWNER",branchId,badService,rpc),
    });
    expect(noProof).toMatchObject({ok:false,code:"PRICING_REVISION_READBACK_UNVERIFIED"});
  });

  it("never serves a dispatcher saved rate details", async () => {
    const from = vi.fn();
    const denied = await loadAuthorizedOwnerPricingBooks("test-cleaning", {
      mode: () => "SERVICE_ROLE", resolveActor: actor("DISPATCHER",branchId,{from}),
    });
    expect(denied).toMatchObject({ok:false,code:"PRICING_REVISION_OWNER_REQUIRED"});
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps the SQL command gated to service_role with CAS and audit", () => {
    const sql = readFileSync("supabase/migrations/0064_v4_owner_cleaning_pricing_revision.sql","utf8");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("where workspace_id=v_workspace and branch_id=v_branch and active for update");
    expect(sql).toContain("v_old_book.version<>v_expected_version");
    expect(sql).toContain("cleaning_pricing.revised");
    expect(sql).toContain("grant execute on function public.servicedesk_revise_owner_cleaning_pricing(jsonb)");
    expect(sql).toMatch(/from public, anon, authenticated/);
    expect(sql).not.toMatch(/http_|net\.http|pg_notify/);
  });
});
