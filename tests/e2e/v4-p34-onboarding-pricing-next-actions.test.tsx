import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OwnerCommercialActionPanel } from "../../src/features/onboarding/OwnerCommercialActionPanel";

type Evidence = Parameters<typeof OwnerCommercialActionPanel>[0]["evidence"];
const view=(evidence:Evidence, canEnterFirstRunRates=false, workspaceSlug="north & south")=>
  renderToStaticMarkup(createElement(OwnerCommercialActionPanel, {
    workspaceSlug,evidence,canEnterFirstRunRates,
  }));

describe("P34 owner commercial next actions use only persisted readiness summaries",()=>{
  it("renders BOTH repair and first-run actions for separate USD branches",()=>{
    const html=view({state:"UNVERIFIED",missingPriceBookBranches:1,repairPriceBookBranches:1},true);
    expect(html).toContain("saved USD branch price book");
    expect(html).toContain("cannot be overwritten by first-run setup");
    expect(html).toContain("1 authorized USD branch");
    expect(html).toContain("Enter actual first-run branch rates");
    expect(html).toContain('href="/app/north%20%26%20south/settings#owner-first-run-pricing"');
    expect(html).toContain('href="/app/north%20%26%20south/settings"');
    expect(html).toContain("do not save rates");
  });
  it("never links to a nonexistent first-run form when all available books already exist",()=>{
    const html=view({state:"UNVERIFIED",missingPriceBookBranches:0,repairPriceBookBranches:2},true);
    expect(html).toContain("2 saved USD branch price books need correction");
    expect(html).not.toContain("#owner-first-run-pricing");
    expect(html).not.toContain("Enter actual first-run branch rates");
  });
  it("does not infer a first-run permission from unknown pricing evidence",()=>{
    const html=view({state:"UNVERIFIED",missingPriceBookBranches:0,repairPriceBookBranches:0},true);
    expect(html).toContain("Saved service or pricing evidence is unavailable");
    expect(html).not.toContain("#owner-first-run-pricing");
    expect(html).toContain("Review owner Settings");
  });
  it("honors actual availability when first-run price books are genuinely missing",()=>{
    const missing:Evidence={state:"NEEDS_PRICE_BOOK",missingPriceBookBranches:2,repairPriceBookBranches:0};
    const noForm=view(missing,false);
    expect(noForm).toContain("Verify first-run eligibility");
    expect(noForm).not.toContain("#owner-first-run-pricing");
    const yesForm=view(missing,true);
    expect(yesForm).toContain("2 authorized USD branches");
    expect(yesForm).toContain("#owner-first-run-pricing");
  });
  it("keeps unsupported currency and missing service steps scoped to owner Settings",()=>{
    for(const state of ["UNSUPPORTED_CURRENCY","NEEDS_SERVICE"] as const){
      const html=view({state,missingPriceBookBranches:0},true);
      expect(html).toContain('href="/app/north%20%26%20south/settings"');
      expect(html).not.toContain("#owner-first-run-pricing");
    }
  });
  it("hides setup actions for saved source-ready book proof without claiming quote approval",()=>{
    const html=view({state:"VERIFIED",missingPriceBookBranches:0},true);
    expect(html).toBe("");
  });
  it("is wired into the authenticated owner route, without adding data mutation",()=>{
    const route=readFileSync("src/features/onboarding/OnboardingProductRoute.tsx","utf8");
    const panel=readFileSync("src/features/onboarding/OwnerCommercialActionPanel.tsx","utf8");
    expect(route).toContain("loadOnboardingProduct(workspaceSlug)");
    expect(route).toContain("<OwnerCommercialActionPanel");
    expect(route).toContain("evidence={commercial}");
    expect(route).toContain("canEnterFirstRunRates={canEnterFirstRunRates}");
    expect(panel).toContain("buildStaffModuleHref(workspaceSlug, \"settings\")");
    expect(panel).not.toContain("fetch(");
    expect(panel).not.toContain(".rpc(");
    expect(panel).not.toContain("service_role");
  });
});
