import { describe, expect, it } from "vitest";
import { quotePriceReadiness } from "../../src/features/operations/request-quote-price-readiness";
import type { OperationalBranchScope } from "../../src/features/operations/operational-product-runtime";

const north={id:"north",code:"N",name:"North",currency:"USD",timezone:"UTC",isDefault:true};
const south={id:"south",code:"S",name:"South",currency:"USD",timezone:"UTC",isDefault:false};
const uk={id:"uk",code:"UK",name:"London",currency:"GBP",timezone:"UTC",isDefault:false};
const scope:OperationalBranchScope={mode:"ALL",branches:[north,south,uk]};
const input={
  actorRole:"OWNER",branchScope:scope,
  request:{branchId:"north"},
  ownerPricingBookProof:{state:"VERIFIED" as const,activeBranchIds:["north"],existingBookBranchIds:["north"]},
};

describe("P36 owner quote preflight uses saved request branch and independent price-book inventory",()=>{
  it("recognizes only an authorized, explicitly saved USD request branch with a backed active book",()=>{
    const result=quotePriceReadiness(input);
    expect(result).toMatchObject({state:"VERIFIED",branchId:"north"});
    expect(result.message).toContain("server still validates");
  });
  it("never invents a branch from the only price book or a selected owner view",()=>{
    for(const request of [{branchId:""},{branchId:undefined}]){
      const result=quotePriceReadiness({...input,request});
      expect(result.state).toBe("BRANCH_UNRESOLVED");
    }
    const scoped:OperationalBranchScope={mode:"BRANCH",selectedBranchId:"north",branches:[north,south]};
    expect(quotePriceReadiness({...input,request:{branchId:undefined},branchScope:scoped}).state)
      .toBe("BRANCH_UNRESOLVED");
  });
  it("rejects foreign or outside-selected-scope request branches rather than borrowing book evidence",()=>{
    const selected:OperationalBranchScope={mode:"BRANCH",selectedBranchId:"north",branches:[north,south]};
    expect(quotePriceReadiness({...input,branchScope:selected,request:{branchId:"south"},
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:["north","south"],existingBookBranchIds:["north","south"]}})
      .state).toBe("BRANCH_UNRESOLVED");
    expect(quotePriceReadiness({...input,request:{branchId:"foreign"}}).state)
      .toBe("BRANCH_UNRESOLVED");
  });
  it("keeps non-USD branches out of USD owner pricing even with fabricated saved book labels",()=>{
    expect(quotePriceReadiness({...input,request:{branchId:"uk"},
      ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:["north","uk"],existingBookBranchIds:["north","uk"]}})
      .state).toBe("OWNER_SETUP_REQUIRED");
  });
  it("never treats a missing or inconsistent saved-book inventory as VERIFIED",()=>{
    const cases=[
      undefined,
      {state:"UNAVAILABLE" as const,activeBranchIds:[],existingBookBranchIds:[]},
      {state:"VERIFIED" as const,activeBranchIds:["north"]},
      {state:"VERIFIED" as const,activeBranchIds:["north"],existingBookBranchIds:[]},
      {state:"VERIFIED" as const,activeBranchIds:["foreign"],existingBookBranchIds:["foreign"]},
      {state:"VERIFIED" as const,activeBranchIds:["north"],existingBookBranchIds:["north","foreign"]},
    ];
    for(const ownerPricingBookProof of cases){
      expect(quotePriceReadiness({...input,ownerPricingBookProof}).state).toBe("EVIDENCE_UNAVAILABLE");
    }
  });
  it("does not confuse an authorized unpriced branch with a different priced branch",()=>{
    expect(quotePriceReadiness({...input,request:{branchId:"south"}}).state)
      .toBe("OWNER_SETUP_REQUIRED");
  });
  it("refuses a missing or legacy authorization scope instead of trusting active-book arrays",()=>{
    expect(quotePriceReadiness({...input,branchScope:undefined}).state).toBe("EVIDENCE_UNAVAILABLE");
    expect(quotePriceReadiness({...input,branchScope:{mode:"LEGACY",branches:[]}}).state)
      .toBe("EVIDENCE_UNAVAILABLE");
  });
  it("does not expose owner-only price book evidence to non-owner staff",()=>{
    for(const actorRole of ["DISPATCHER","CREW","CUSTOMER","ANONYMOUS"]){
      const res=quotePriceReadiness({...input,actorRole});
      expect(res.state).toBe("SERVER_VALIDATION_REQUIRED");
      expect(res.message).toContain("server");
      expect(res).not.toHaveProperty("branchId");
    }
  });
});
