import {describe,expect,it} from "vitest";
import {summarizeOwnerPricingCompletion} from "../../src/features/operations/owner-pricing-form-completion";

describe("owner-priced cleaning first-run completeness",()=>{
  it("counts only enabled required fields and never supplies prices",()=>{
    expect(summarizeOwnerPricingCompletion([
      {required:true,valid:true},
      {required:true,valid:false},
      {required:false,valid:false},
      {required:true,valid:false,disabled:true},
    ])).toEqual({completed:1,total:2,remaining:1});
  });
  it("represents a genuinely completed required set",()=>{
    expect(summarizeOwnerPricingCompletion([
      {required:true,valid:true},{required:true,valid:true},
    ])).toEqual({completed:2,total:2,remaining:0});
    expect(summarizeOwnerPricingCompletion([]))
      .toEqual({completed:0,total:0,remaining:0});
  });
});
