import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CatalogReadinessBanner } from "../../src/features/operations/CatalogReadinessBanner";
import type { OperationalBranchScope } from "../../src/features/operations/operational-product-runtime";

const scope: OperationalBranchScope = { mode: "ALL", branches: [
  { id: "east", code: "E", name: "East service", currency: "USD", timezone: "UTC", isDefault: true },
  { id: "west", code: "W", name: "West service", currency: "USD", timezone: "UTC", isDefault: false },
  { id: "other", code: "O", name: "Overseas service", currency: "EUR", timezone: "UTC", isDefault: false },
] };
const catalog=[{id:"standard-one",code:"STANDARD",name:"Standard",active:true,requiresReview:false,updatedAt:"2026-10-29"}];
const html = (branchScope=scope, proof?: {state:"VERIFIED"|"UNAVAILABLE";activeBranchIds:string[];existingBookBranchIds?:string[]}) =>
  renderToStaticMarkup(createElement(CatalogReadinessBanner, {
    workspaceSlug:"fictional-owner",serviceCatalog:catalog,branchScope,ownerPricingBookProof:proof,
  }));

describe("P25 independent owner-pricing readiness critic", () => {
  it("reports separate repair and first-run workflows when different saved branches need each", () => {
    const output=html(scope,{state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:["east"]});
    expect(output).toContain("Saved branch pricing needs correction");
    expect(output).toContain("East service");
    expect(output).toContain("Quoting setup incomplete");
    expect(output).toContain("West service");
    expect(output).toContain("#owner-first-run-pricing");
    expect(output).not.toContain("Overseas service");
  });
  it("never offers first-run over an existing active saved book, even if its rates are broken", () => {
    const selected: OperationalBranchScope={...scope,mode:"BRANCH",selectedBranchId:"east"};
    const output=html(selected,{state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:["east"]});
    expect(output).toContain("First-run setup cannot overwrite");
    expect(output).not.toContain("#owner-first-run-pricing");
    expect(output).not.toContain("West service");
  });
  it("cannot turn a missing independent book inventory into a silent readiness PASS", () => {
    const output=html(scope,{state:"VERIFIED",activeBranchIds:["east"]});
    expect(output).toContain("readiness could not be verified");
    expect(output).not.toContain("#owner-first-run-pricing");
  });
  it("leaves the control surface read-only: only navigation to owner settings", () => {
    const banner=readFileSync("src/features/operations/CatalogReadinessBanner.tsx","utf8");
    expect(banner).toContain('buildStaffModuleHref(workspaceSlug, "settings")');
    expect(banner).toContain("invalidSaved.length > 0");
    expect(banner).toContain("unconfigured.length > 0");
    expect(banner).toContain("existingBookBranchIds");
    expect(banner).not.toContain("service_role");
    expect(banner).not.toContain(".rpc(");
    expect(banner).not.toContain("createClient(");
    expect(banner).not.toContain("fetch(");
  });
});
