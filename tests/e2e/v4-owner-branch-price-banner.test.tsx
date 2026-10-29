import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogReadinessBanner } from "../../src/features/operations/CatalogReadinessBanner";
import type { OperationalBranchScope, OperationalServiceCatalogItem } from "../../src/features/operations/operational-product-runtime";

const savedActiveCatalog: OperationalServiceCatalogItem[] = [{
  id: "service-one", code: "STANDARD", name: "Standard clean",
  active: true, requiresReview: false, updatedAt: "2026-10-12",
}];

const branches: OperationalBranchScope["branches"] = [
  { id: "branch-one", code: "B1", name: "North cleaning", timezone: "America/New_York", currency: "USD", isDefault: true },
  { id: "branch-two", code: "B2", name: "South cleaning", timezone: "America/New_York", currency: "USD", isDefault: false },
  { id: "branch-three", code: "B3", name: "UK cleaning", timezone: "Europe/London", currency: "GBP", isDefault: false },
];

const scope: OperationalBranchScope = { mode: "ALL", branches };
const markup = (props: React.ComponentProps<typeof CatalogReadinessBanner>) =>
  renderToStaticMarkup(createElement(CatalogReadinessBanner, props));

describe("V4 owner-visible branch pricing readiness", () => {
  it("does not call a workspace quotable just because its service catalog has one active item", () => {
    const html = markup({
      workspaceSlug: "east-office", serviceCatalog: savedActiveCatalog,
      branchScope: scope, ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-one"], existingBookBranchIds: ["branch-one"] },
    });
    expect(html).toContain("Quoting setup incomplete");
    expect(html).toContain("South cleaning");
    expect(html).toContain("no verified active branch price book");
    expect(html).toContain("/app/east-office/settings");
    expect(html).not.toContain("UK cleaning");
  });

  it("shows the exact eligible missing USD count, not unconfigured GBP branches", () => {
    const html = markup({
      workspaceSlug: "east-office", serviceCatalog: savedActiveCatalog,
      branchScope: scope, ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: [], existingBookBranchIds: [] },
    });
    expect(html).toContain("2 USD branches");
    expect(html).not.toContain("3 USD branches");
  });

  it("respects the selected branch and does not imply other branch readiness", () => {
    const selectedScope: OperationalBranchScope = { ...scope, mode: "BRANCH", selectedBranchId: "branch-one" };
    expect(markup({
      workspaceSlug: "east-office", serviceCatalog: savedActiveCatalog,
      branchScope: selectedScope, ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-one"], existingBookBranchIds: ["branch-one"] },
    })).toBe("");
    expect(markup({
      workspaceSlug: "east-office", serviceCatalog: savedActiveCatalog,
      branchScope: selectedScope, ownerPricingBookProof: { state: "VERIFIED", activeBranchIds: ["branch-two"], existingBookBranchIds: ["branch-two"] },
    })).toContain("North cleaning");
  });

  it("renders BOTH existing-book repair and missing-branch first-run CTAs without hiding either blocker", () => {
    const html=markup({
      workspaceSlug:"east-office",serviceCatalog:savedActiveCatalog,
      branchScope:scope,
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:[],
        existingBookBranchIds:["branch-one"]},
    });
    expect(html).toContain("Saved branch pricing needs correction");
    expect(html).toContain("North cleaning");
    expect(html).toContain("First-run setup cannot overwrite");
    expect(html).toContain("Quoting setup incomplete");
    expect(html).toContain("South cleaning");
    expect(html).toContain("#owner-first-run-pricing");
    expect(html).toContain("/app/east-office/settings");
    expect(html).not.toContain("UK cleaning");
  });

  it("does not quietly declare readiness when a VERIFIED proof lacks independent inventory", () => {
    const html=markup({
      workspaceSlug:"east-office",serviceCatalog:savedActiveCatalog,
      branchScope:scope,
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:["branch-one"]},
    });
    expect(html).toContain("Branch pricing readiness could not be verified");
    expect(html).toContain("independent saved price-book inventory is incomplete");
    expect(html).not.toContain("#owner-first-run-pricing");
  });

  it("restricts combined first-run and repair blockers to the selected branch", () => {
    const pickedScope: OperationalBranchScope={...scope,mode:"BRANCH",selectedBranchId:"branch-two"};
    const html=markup({
      workspaceSlug:"east-office",serviceCatalog:savedActiveCatalog,
      branchScope:pickedScope,
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:[],
        existingBookBranchIds:["branch-one"]},
    });
    expect(html).toContain("South cleaning");
    expect(html).not.toContain("North cleaning");
    expect(html).not.toContain("Saved branch pricing needs correction");
    expect(html).toContain("#owner-first-run-pricing");
  });

  it("shows repair guidance rather than a dead first-run CTA for configured-but-invalid pricing", () => {
    const html=markup({
      workspaceSlug:"east-office",serviceCatalog:savedActiveCatalog,
      branchScope:scope,
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:["branch-two"],
        existingBookBranchIds:["branch-one","branch-two"]},
    });
    expect(html).toContain("Saved branch pricing needs correction");
    expect(html).toContain("North cleaning");
    expect(html).toContain("First-run setup cannot overwrite");
    expect(html).toContain("/app/east-office/settings");
    expect(html).not.toContain("#owner-first-run-pricing");
  });

    it("fails closed when owner price-book evidence is unavailable", () => {
    const unknown = markup({
      workspaceSlug: "east-office", serviceCatalog: savedActiveCatalog,
      branchScope: scope, ownerPricingBookProof: { state: "UNAVAILABLE", activeBranchIds: [], existingBookBranchIds: [] },
    });
    expect(unknown).toContain("readiness could not be verified");
    expect(unknown).toContain("not proof that real customer quotes are ready");
    expect(markup({workspaceSlug: "east-office", serviceCatalog: savedActiveCatalog})).toBe("");
  });

  it("threads only persisted owner proof into Today and Requests, without creating prices", () => {
    const load = (name: string) => readFileSync(join(process.cwd(), name), "utf8");
    const today = load("src/features/operations/StaffOverviewDashboard.tsx");
    const views = load("src/features/operations/OperationalProductRoute.tsx");
    expect(today).toContain("ownerPricingBookProof={snapshot.ownerPricingBookProof}");
    expect(today).toContain("branchScope={snapshot.branchScope}");
    expect(views.match(/ownerPricingBookProof=\{data.ownerPricingBookProof\}/g)?.length).toBe(2);
    expect(views).toContain("serviceCatalog={data.serviceCatalog}");
  });
});
