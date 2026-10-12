import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { quotePriceReadiness } from
  "../../src/features/operations/request-quote-price-readiness";

const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const verified={state:"VERIFIED" as const,activeBranchIds:[a]};

describe("request queue saved branch-price eligibility",()=>{
  it("permits a verified owner branch and still requires server validation",()=>{
    expect(quotePriceReadiness({
      request:{branchId:a},actorRole:"OWNER",ownerPricingBookProof:verified,
    })).toMatchObject({state:"VERIFIED",branchId:a});
  });
  it("keeps owners blocked for another branch even if some other branch is priced",()=>{
    expect(quotePriceReadiness({
      request:{branchId:b},actorRole:"OWNER",ownerPricingBookProof:verified,
    })).toMatchObject({state:"OWNER_SETUP_REQUIRED"});
  });
  it("never mistakes an unavailable owner snapshot for a verified empty list",()=>{
    for(const proof of [undefined,{state:"UNAVAILABLE" as const,activeBranchIds:[]}]){
      expect(quotePriceReadiness({
        request:{branchId:a},actorRole:"OWNER",ownerPricingBookProof:proof,
      }).state).toBe("EVIDENCE_UNAVAILABLE");
    }
  });
  it("reports missing real prices separately from unknown pricing",()=>{
    expect(quotePriceReadiness({
      request:{branchId:a},actorRole:"OWNER",
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:[]},
    }).state).toBe("OWNER_SETUP_REQUIRED");
  });
  it("does not invent a branch from multiple eligible branches",()=>{
    expect(quotePriceReadiness({
      request:{},actorRole:"OWNER",
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:[a,b]},
    }).state).toBe("BRANCH_UNRESOLVED");
  });
  it("supports the owner-selected branch when the request has no explicit branch",()=>{
    expect(quotePriceReadiness({
      request:{},actorRole:"OWNER",ownerPricingBookProof:verified,
      branchScope:{mode:"BRANCH",selectedBranchId:a,branches:[]},
    })).toMatchObject({state:"VERIFIED",branchId:a});
  });
  it("does not let an unrelated branch-scope selection override a real request branch",()=>{
    expect(quotePriceReadiness({
      request:{branchId:b},actorRole:"OWNER",ownerPricingBookProof:verified,
      branchScope:{mode:"BRANCH",selectedBranchId:a,branches:[]},
    }).state).toBe("OWNER_SETUP_REQUIRED");
  });
  it("keeps staff without owner-only price-book proof on server-validated route",()=>{
    expect(quotePriceReadiness({
      request:{branchId:b},actorRole:"DISPATCHER",
    }).state).toBe("SERVER_VALIDATION_REQUIRED");
  });
  it("the real requests page blocks misleading owner calculate and shows a useful remedy",()=>{
    const view=readFileSync(join(process.cwd(),
      "src/features/operations/OperationalProductRoute.tsx"),"utf8");
    expect(view).toContain('pricingReadiness.state === "VERIFIED"');
    expect(view).toContain('data.actor.role !== "OWNER" || pricingReadiness.state === "VERIFIED"');
    expect(view).toContain("Saved branch pricing");
    expect(view).toContain("pricingReadiness.message");
  });
});
