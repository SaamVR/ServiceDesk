import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessOwnerPricingRevisionAccess } from "@/features/operations/owner-pricing-revision-access";
import type { OwnerExistingPricingBook } from "@/server/core/owner-cleaning-pricing-revision";
import type { OperationalBranchScope } from "@/features/operations/operational-product-runtime";

const id = "a3df13ec-c912-4d53-87a5-51e9a34a3381";
const bookId = "b76ab96e-e55b-4ccc-9779-2403a84aca9f";
const branch = { id, code:"US-N", name:"North", currency:"USD",
  timezone:"UTC", isDefault:true };
const other = { ...branch, id:"3c1b815e-989c-4d3e-a55f-ae9b23a929fc", code:"US-S", name:"South" };
const scope: OperationalBranchScope = {
  mode:"BRANCH", selectedBranchId:id, branches:[branch,other],
};
const target: OwnerExistingPricingBook = {
  branch, bookId, bookVersion:3, rateCardId:bookId, rateVersion:"v3",
  rateCurrency:"USD", depositPercent:20, validHours:24,
  bufferMinutes:10, startsAt:null, endsAt:null, rules:{},
  serviceNames:{STANDARD:"Standard clean",DEEP:"Deep clean",MOVE_OUT:"Move out clean"},
  diagnosis:{state:"READY_CANDIDATE",code:"CURRENT_SAVED_PRICING",message:"Saved book"},
};
const evaluate=(s: OperationalBranchScope | undefined, t:OwnerExistingPricingBook=target)=>
  assessOwnerPricingRevisionAccess(s,t);

describe("P35 pricing revision authorization and conflict-prevention UI",()=>{
  it("admits an exactly authorized USD revision/version for explicit owner review only",()=>{
    expect(evaluate(scope)).toEqual({state:"READY_FOR_OWNER_REVIEW",version:3,branchName:"North"});
    expect(evaluate({...scope,mode:"ALL",selectedBranchId:undefined})).toMatchObject({
      state:"READY_FOR_OWNER_REVIEW" });
  });
  it("fails closed on missing, legacy, empty or contradictory branch authority",()=>{
    expect(evaluate(undefined).state).toBe("UNVERIFIED_SCOPE");
    expect(evaluate({...scope,mode:"LEGACY"}).state).toBe("UNVERIFIED_SCOPE");
    expect(evaluate({...scope,branches:[]}).state).toBe("UNVERIFIED_SCOPE");
    expect(evaluate({...scope,branches:[branch,branch]}).state).toBe("FOREIGN_BRANCH");
  });
  it("rejects selected wrong branch, unknown target, wrong currency and branch-code spoofing",()=>{
    for(const [s,t] of [
      [{...scope,selectedBranchId:other.id},target],
      [scope,{...target,branch:other}],
      [scope,{...target,branch:{...branch,currency:"GBP"}}],
      [scope,{...target,branch:{...branch,code:"OTHER"}}],
      [{...scope,branches:[{...branch,currency:"GBP"},other]},target],
    ] as Array<[OperationalBranchScope,OwnerExistingPricingBook]>) {
      expect(evaluate(s,t).state).toBe("FOREIGN_BRANCH");
    }
  });
  it("rejects non-UUID, missing, overflow and fractional concurrency versions",()=>{
    for(const patch of [
      {bookId:"not-a-book"}, {bookVersion:0}, {bookVersion:-1},
      {bookVersion:Number.NaN}, {bookVersion:1.5}, {bookVersion:1_000_000_001},
    ]) expect(evaluate(scope,{...target,...patch}).state).toBe("UNVERIFIED_BOOK");
  });
  it("wires owner acknowledgement into revision only, preserving full-replacement and server CAS",()=>{
    const ui=readFileSync("src/features/operations/OwnerCleaningPricingSetupForm.tsx","utf8");
    expect(ui).toContain("assessOwnerPricingRevisionAccess(scope, repairTarget)");
    expect(ui).toContain('revisionAccess.state !== "READY_FOR_OWNER_REVIEW"');
    expect(ui).toContain('name="ownerRevisionAcknowledged"');
    expect(ui).toContain('type="checkbox"');
    expect(ui).toContain("The server will reject a stale version.");
    expect(ui).toContain('name="expectedBookVersion"');
    expect(ui).toContain('name="expectedBookId"');
    expect(ui).toContain("Save verified first-run pricing");
    expect(ui).not.toContain("fetch(");
    expect(ui).not.toContain(".rpc(");
  });
});
