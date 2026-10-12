import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { availableFirstRunUsdBranches } from "../../src/features/operations/owner-pricing-readiness";
import type { OperationalBranchScope } from "../../src/features/operations/operational-product-runtime";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const scope: OperationalBranchScope = {
  mode: "ALL",
  branches: [
    { id: "usd-one", name: "Northern Cleaning", code: "NORTH", currency: "USD",
      timezone: "America/New_York", isDefault: true },
    { id: "usd-two", name: "Southern Cleaning", code: "SOUTH", currency: "USD",
      timezone: "America/Chicago", isDefault: false },
    { id: "gbp-one", name: "London", code: "LON", currency: "GBP",
      timezone: "Europe/London", isDefault: false },
  ],
};

describe("V4 owner-first-run real USD pricing action navigation", () => {
  it("shows the real pricing form anchor and never supplies invented prices", () => {
    const form = read("src/features/operations/OwnerCleaningPricingSetupForm.tsx");
    expect(form).toContain('id="owner-first-run-pricing"');
    expect(form).toContain('aria-label="First-run owner cleaning pricing"');
    expect(form).toContain("scrollMarginTop: 112");
    expect(form).toContain('placeholder="Enter actual price"');
    expect(form).toContain("no sandbox,");
    expect(form).toContain("Save verified first-run pricing");
    expect(form).not.toContain('defaultValue="99"');
    expect(form).not.toContain('defaultValue="199"');
  });

  it("deep-links from onboarding only when an authorized missing USD price book exists", () => {
    const page = read("src/features/onboarding/OnboardingProductRoute.tsx");
    expect(page).toContain("availableFirstRunUsdBranches(branchScope, ownerPricingBookProof)");
    expect(page).toContain('canEnterFirstRunRates ? "#owner-first-run-pricing" : ""');
    expect(page).toContain("Enter actual cleaning rates");
    expect(page).toContain('href={needsPricing ? realPricingHref : workspaceBase + "/overview"}');
    expect(page).toContain("Review branch pricing in Settings");
    expect(page).toContain("Configure actual services");
    expect(page).toContain('workspaceBase + "/settings"');
    expect(page).toContain("loadOnboardingProduct(workspaceSlug)");
  });

  it("avoids dead anchors when pricing proof is unavailable, configured or not in USD", () => {
    expect(availableFirstRunUsdBranches(scope)).toEqual([]);
    expect(availableFirstRunUsdBranches(scope, {
      state: "UNAVAILABLE", activeBranchIds: [],
    })).toEqual([]);
    expect(availableFirstRunUsdBranches(scope, {
      state: "VERIFIED", activeBranchIds: ["usd-one", "usd-two"],
    })).toEqual([]);
    expect(availableFirstRunUsdBranches(scope, {
      state: "VERIFIED", activeBranchIds: ["usd-one"],
    }).map(item => item.id)).toEqual(["usd-two"]);
  });

  it("never offers a first-run target for another branch outside the selected scope", () => {
    const selected: OperationalBranchScope = {
      ...scope, mode: "BRANCH", selectedBranchId: "usd-one",
    };
    expect(availableFirstRunUsdBranches(selected, {
      state: "VERIFIED", activeBranchIds: ["usd-one"],
    })).toEqual([]);
    expect(availableFirstRunUsdBranches(selected, {
      state: "VERIFIED", activeBranchIds: [],
    }).map(item => item.id)).toEqual(["usd-one"]);
  });

  it("directs quote readiness banners to real rates and retains safe generic fallback", () => {
    const banner = read("src/features/operations/CatalogReadinessBanner.tsx");
    expect(banner).toContain('settingsHref + "#owner-first-run-pricing"');
    expect(banner).toContain("availableFirstRunUsdBranches(branchScope, ownerPricingBookProof)");
    expect(banner).toContain("action={rateSetupLink}");
    expect(banner).toContain("action={settingsLink}");
    expect(banner).toContain("no active cleaning service");
  });

  it("owner form remains protected by verified owner, scope and server action", () => {
    const settings = read("src/features/operations/OperationalProductRoute.tsx");
    expect(settings).toContain('data.actor.role === "OWNER"');
    expect(settings).toContain("availableFirstRunUsdBranches");
    expect(settings).toContain("OwnerCleaningPricingSetupForm");
    expect(settings).toContain("firstRunCleaningPricingAction");
    expect(settings).toContain("setupAuthorizedCleaningPricing");
  });
});
