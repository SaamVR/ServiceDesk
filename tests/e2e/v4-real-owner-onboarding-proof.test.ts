import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeOwnerCommercialSetup } from "../../src/features/onboarding/onboarding-commercial-readiness";
import type {
  OperationalBranchScope, OperationalServiceCatalogItem,
} from "../../src/features/operations/operational-product-runtime";

const service: OperationalServiceCatalogItem = {
  id: "svc-1", code: "STANDARD", name: "Standard clean", active: true,
  requiresReview: false, updatedAt: "2026-10-12T00:00:00Z",
};
const scope: OperationalBranchScope = {
  mode: "ALL",
  branches: [
    { id: "branch-a", code: "US-A", name: "North", currency: "USD", timezone: "America/New_York", isDefault: true },
    { id: "branch-b", code: "US-B", name: "South", currency: "USD", timezone: "America/Chicago", isDefault: false },
    { id: "branch-uk", code: "UK", name: "London", currency: "GBP", timezone: "Europe/London", isDefault: false },
  ],
};

describe("V4 real owner first-run operational readiness", () => {
  it("requires an active saved catalog service, not a decorative legacy settings label", () => {
    expect(summarizeOwnerCommercialSetup({ catalog: [], scope, proof: { state: "VERIFIED", activeBranchIds: [], existingBookBranchIds: [] } }))
      .toMatchObject({ state: "NEEDS_SERVICE", activeServices: 0 });
    expect(summarizeOwnerCommercialSetup({ catalog: [{ ...service, active: false }], scope,
      proof: { state: "VERIFIED", activeBranchIds: ["branch-a"], existingBookBranchIds: ["branch-a"] } }))
      .toMatchObject({ state: "NEEDS_SERVICE", activeServices: 0 });
    expect(summarizeOwnerCommercialSetup({ scope, proof: { state: "VERIFIED", activeBranchIds: [], existingBookBranchIds: [] } }))
      .toMatchObject({ state: "UNVERIFIED", activeServices: 0 });
  });

  it("does not call unrelated active catalog items cleaning-quote ready", () => {
    const carpet = { ...service, code: "WINDOWS", name: "Window cleaning" };
    const evidence = summarizeOwnerCommercialSetup({ catalog: [carpet], scope,
      proof: { state: "VERIFIED", activeBranchIds: ["branch-a", "branch-b"], existingBookBranchIds: ["branch-a", "branch-b"] } });
    expect(evidence).toMatchObject({
      state: "NEEDS_SERVICE", activeServices: 1, quoteableCleaningServices: 0,
    });
    expect(evidence.detail).toContain("Standard, Deep or Move-Out");
    const mixed = summarizeOwnerCommercialSetup({ catalog: [carpet, service], scope,
      proof: { state: "VERIFIED", activeBranchIds: ["branch-a", "branch-b"], existingBookBranchIds: ["branch-a", "branch-b"] } });
    expect(mixed).toMatchObject({
      state: "VERIFIED", activeServices: 2, quoteableCleaningServices: 1,
    });
  });

  it("does not classify an unquotable but active existing book as first-run missing or verified", () => {
    const input={catalog:[service],scope,proof:{
      state:"VERIFIED" as const,activeBranchIds:[],
      existingBookBranchIds:["branch-a","branch-b"],
    }};
    const result=summarizeOwnerCommercialSetup(input);
    expect(result).toMatchObject({state:"UNVERIFIED",missingPriceBookBranches:0});
    expect(result.detail).toContain("cannot overwrite");
  });

    it("fails closed when the branch book proof cannot be read", () => {
    expect(summarizeOwnerCommercialSetup({ catalog: [service], scope }))
      .toMatchObject({ state: "UNVERIFIED", eligibleUsdBranches: 0 });
    expect(summarizeOwnerCommercialSetup({ catalog: [service], scope,
      proof: { state: "UNAVAILABLE", activeBranchIds: [], existingBookBranchIds: [] } })).toMatchObject({ state: "UNVERIFIED" });
  });

  it("distinguishes partly configured USD branches from verified books", () => {
    const proof = { state: "VERIFIED" as const, activeBranchIds: ["branch-a"], existingBookBranchIds: ["branch-a"] };
    const result = summarizeOwnerCommercialSetup({ catalog: [service], scope, proof });
    expect(result).toMatchObject({
      state: "NEEDS_PRICE_BOOK", activeServices: 1, eligibleUsdBranches: 2,
      missingPriceBookBranches: 1,
    });
    expect(result.detail).toContain("South");
    const all = summarizeOwnerCommercialSetup({ catalog: [service], scope,
      proof: { state: "VERIFIED", activeBranchIds: ["branch-a", "branch-b"], existingBookBranchIds: ["branch-a", "branch-b"] } });
    expect(all).toMatchObject({ state: "VERIFIED", eligibleUsdBranches: 2, missingPriceBookBranches: 0 });
    expect(all.detail).toContain("Individual quotes still require validated services");
  });

  it("never claims unsupported or unauthorized branch currencies are ready", () => {
    const selected: OperationalBranchScope = { ...scope, mode: "BRANCH", selectedBranchId: "branch-b" };
    const result = summarizeOwnerCommercialSetup({ catalog: [service], scope: selected,
      proof: { state: "VERIFIED", activeBranchIds: ["branch-a"], existingBookBranchIds: ["branch-a"] } });
    expect(result).toMatchObject({ state: "NEEDS_PRICE_BOOK", missingPriceBookBranches: 1,
      eligibleUsdBranches: 1 });
    const gbOnly: OperationalBranchScope = { ...scope, mode: "BRANCH", selectedBranchId: "branch-uk" };
    expect(summarizeOwnerCommercialSetup({ catalog: [service], scope: gbOnly,
      proof: { state: "VERIFIED", activeBranchIds: ["branch-uk"], existingBookBranchIds: ["branch-uk"] } }))
      .toMatchObject({ state: "UNSUPPORTED_CURRENCY", eligibleUsdBranches: 0 });
  });

  it("shows the real setup status and action links without inventing quotes or provider delivery", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const route = read("src/features/onboarding/OnboardingProductRoute.tsx");
    expect(route).toContain("serviceCatalog.filter(service => service.active)");
    expect(route).toContain("summarizeOwnerCommercialSetup");
    expect(route).toContain("commercial.quoteableCleaningServices > 0");
    expect(route).toContain("ownerPricingBookProof");
    expect(route).toContain('String(readyCount) + "/5"');
    expect(route).toContain("Branch price books");
    expect(route).toContain("Review branch pricing in Settings");
    expect(route).toContain('workspaceBase + "/automations"');
    expect(route).toContain('workspaceBase + "/requests"');
    expect(route).toContain("not a live-provider");
    expect(route).not.toContain("successfully sent");
  });
});
