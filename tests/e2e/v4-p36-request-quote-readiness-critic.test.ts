import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quotePriceReadiness } from "../../src/features/operations/request-quote-price-readiness";

const src=readFileSync("src/features/operations/request-quote-price-readiness.ts","utf8");
const route=readFileSync("src/features/operations/OperationalProductRoute.tsx","utf8");

describe("P36 independent read-only quote readiness security critic",()=>{
  it("requires persisted request branch before any owner-facing price VERIFIED state",()=>{
    expect(src).toContain('typeof input.request.branchId === "string"');
    expect(src).toContain('state: "BRANCH_UNRESOLVED"');
    expect(src).toContain("scope.branches.find(branch => branch.id === candidate");
    expect(src).toContain('scope.mode !== "BRANCH" || scope.selectedBranchId === candidate');
    expect(src).not.toContain("proof.activeBranchIds.length === 1");
    expect(src).not.toContain("selectedBranch ??");
  });
  it("requires independently saved active pricing in the same authorized USD branch",()=>{
    expect(src).toContain("Array.isArray(proof.existingBookBranchIds)");
    expect(src).toContain("!proof.existingBookBranchIds?.includes(id)");
    expect(src).toContain('authorized.currency !== "USD"');
    expect(src).toContain("!proof.activeBranchIds.includes(candidate)");
    expect(src).toContain('scope.mode === "LEGACY"');
  });
  it("does not turn an owner UI badge into an authorization or external side effect",()=>{
    expect(route).toContain("quotePriceReadiness({");
    expect(route).toContain('pricingReadiness.state === "VERIFIED"');
    expect(route).toContain("calculateOperationalQuote(workspaceSlug, requestId,");
    expect(src).toContain('input.actorRole !== "OWNER"');
    expect(src).toContain('"SERVER_VALIDATION_REQUIRED"');
    expect(src).not.toContain(".rpc(");
    expect(src).not.toContain("fetch(");
    expect(src).not.toContain("createClient(");
    expect(src).not.toContain("service_role");
  });
  it("never mistakes unauthorized preview branches for validated quote calculation",()=>{
    const value=quotePriceReadiness({
      actorRole:"OWNER", request:{branchId:"foreign"},
      branchScope:{mode:"ALL",branches:[{id:"authorized",code:"N",name:"North",currency:"USD",timezone:"UTC",isDefault:true}]},
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:["authorized"],existingBookBranchIds:["authorized"]},
    });
    expect(value.state).toBe("BRANCH_UNRESOLVED");
    expect(value).not.toHaveProperty("branchId");
  });
});
