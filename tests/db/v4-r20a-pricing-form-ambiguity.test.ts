import { describe, expect, it } from "vitest";
import { parseOwnerCleaningPricingSetup } from "../../src/server/core/owner-cleaning-pricing-input";
const uuidA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uuidB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function form(): FormData {
  const f=new FormData();
  for(const [k,v] of Object.entries({setupId:uuidA,branchId:uuidB,currency:"USD",
    nameStandard:"Standard clean",nameDeep:"Deep clean",nameMoveOut:"Move-out clean",
    depositPercent:"25",validHours:"48",bufferMinutes:"30",autoApprovalMax:"550.50"})) f.set(k,v);
  for(const prefix of ["standard","deep","moveOut"]){
    f.set(prefix+"Base","125.25");f.set(prefix+"BaseMinutes","90");
    f.set(prefix+"Bedroom","20.00");f.set(prefix+"BedroomMinutes","15");
    f.set(prefix+"Bathroom","15.50");f.set(prefix+"BathroomMinutes","10");
  }
  f.set("moveOutOven","35.50");f.set("moveOutOvenMinutes","25");
  return f;
}
describe("R20A ambiguous merchant pricing form authority",()=>{
  it("allows a complete owner-entered quote form",()=>{
    expect(parseOwnerCleaningPricingSetup(form())).toMatchObject({ok:true,value:{currency:"USD"}});
  });
  it("rejects duplicate scope, catalog names, percent, and prices including same-value doubles",()=>{
    for(const [key,extra] of [["setupId",uuidA],["branchId",uuidB],["currency","USD"],
      ["nameStandard","Standard clean"],["validHours","48"],["standardBase","0.01"],
      ["moveOutOven","35.50"],["moveOutOvenMinutes","10"]]){
      const f=form();f.append(key,extra);
      expect(parseOwnerCleaningPricingSetup(f),key).toMatchObject({ok:false,code:"CLEANING_PRICING_INPUT_INVALID"});
    }
  });
  it("does not permit invisible-directional price labels or missing rate fields",()=>{
    for(const value of ["Clean\u202eprices","Clean\u200bservice","Clean\u2060option"]){
      const f=form();f.set("nameStandard",value);
      expect(parseOwnerCleaningPricingSetup(f)).toMatchObject({ok:false,code:"CLEANING_PRICING_INPUT_INVALID"});
    }
    const incomplete=form();incomplete.delete("moveOutOvenMinutes");
    expect(parseOwnerCleaningPricingSetup(incomplete)).toMatchObject({ok:false,code:"CLEANING_PRICING_INPUT_INVALID"});
  });
  it("does not treat unrelated CSRF metadata as a priced rate field",()=>{
    const f=form();f.set("csrf","opaque-test-only");
    expect(parseOwnerCleaningPricingSetup(f)).toMatchObject({ok:true});
  });
});
