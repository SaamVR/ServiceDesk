import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OperationalStaffSnapshot } from "../../src/features/operations/operational-product-runtime";
import { OwnerAutomationActivationChecklist } from "../../src/features/operations/OwnerAutomationActivationChecklist";

const branch = {
  id: "branch-a",code: "US-A",name: "North",currency: "USD",
  timezone: "America/New_York",isDefault: true,
};
const input = {
  serviceCatalog: [], ownerPricingBookProof: {state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:[]},
  branchScope: { mode: "BRANCH",selectedBranchId:"branch-a",branches:[branch] },
  workflowAvailable:true,workflowRules:[],workflowRuleVersions:[],
  workflowExecutions:[],workflowActionExecutions:[],
};
const view = (data: Record<string,unknown>, slug = "qa-cleaning") =>
  renderToStaticMarkup(createElement(OwnerAutomationActivationChecklist, {
    workspaceSlug:slug,
    data:data as unknown as OperationalStaffSnapshot,
  }));

describe("Owner automation activation checklist direct first-run pricing entry",()=>{
  it("links missing catalog and pricing to the actual first-run form for authorized unpriced USD branch",()=>{
    const html=view(input);
    expect(html).toContain("Enter actual cleaning rates");
    expect(html).toContain('href="/app/qa-cleaning/settings#owner-first-run-pricing"');
    expect(html).toContain("Open Automation Studio");
  });
  it("does not deep-link to a nonexistent form when all available branches are priced",()=>{
    const html=view({...input,ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:["branch-a"],existingBookBranchIds:["branch-a"]}});
    expect(html).toContain('href="/app/qa-cleaning/settings"');
    expect(html).not.toContain("#owner-first-run-pricing");
  });
  it("does not claim a pricing entry route when branch authorization proof is unavailable",()=>{
    const html=view({...input,ownerPricingBookProof:{state:"UNAVAILABLE",activeBranchIds:[],existingBookBranchIds:[]}});
    expect(html).toContain("Open Settings");
    expect(html).not.toContain("#owner-first-run-pricing");
  });
  it("encodes tenant slugs and never sends owner pricing forms to a foreign workspace",()=>{
    const html=view(input,"north & south");
    expect(html).toContain("/app/north%20%26%20south/settings#owner-first-run-pricing");
    expect(html).not.toContain("/app/qa-cleaning/settings");
  });
});
