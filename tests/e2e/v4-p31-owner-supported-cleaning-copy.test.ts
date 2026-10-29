import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describeSavedCleaningCatalog, countDistinctSupportedCleaningTypes } from "../../src/features/onboarding/onboarding-cleaning-catalog-copy";

describe("P31 owner saved-catalog communication integrity",()=>{
  it("does not claim NO service exists when only unrelated active products exist",()=>{
    const message=describeSavedCleaningCatalog(2,0);
    expect(message).toContain("No active Standard, Deep or Move-Out cleaning service");
    expect(message).toContain("2 other active catalog items");
    expect(message).not.toContain("No active service is saved");
    expect(message).toContain("cannot authorize cleaning quotes");
  });
  it("distinguishes an actually empty catalog without invented prices",()=>{
    const message=describeSavedCleaningCatalog(0,0);
    expect(message).toContain("No active Standard, Deep or Move-Out cleaning service");
    expect(message).toContain("actual owner-entered rates");
    expect(message).not.toContain("sample");
  });
  it("reports supported service types distinctly from total active catalog rows",()=>{
    const count=countDistinctSupportedCleaningTypes([
      {active:true,code:"STANDARD"},{active:true,code:"STANDARD"},
      {active:true,code:"WINDOWS"},{active:true,code:"DEEP"},
      {active:false,code:"MOVE_OUT"},
    ]);
    expect(count).toBe(2);
    const message=describeSavedCleaningCatalog(4,count);
    expect(message).toContain("2 supported active cleaning service types");
    expect(message).toContain("4 active catalog items recorded in total");
    expect(message).toContain("Saved branch pricing must be verified separately");
  });
  it("fails closed on contradictory, impossible or partial counts",()=>{
    for(const pair of [[-1,0],[0,1],[2,-1],[2,4],[3,NaN],[Infinity,1],[3,1.5]]){
      expect(describeSavedCleaningCatalog(pair[0],pair[1]))
        .toContain("counts could not be verified");
    }
  });
  it("wires the grounded helper into actual owner onboarding, no provider or DB write",()=>{
    const route=readFileSync("src/features/onboarding/OnboardingProductRoute.tsx","utf8");
    expect(route).toContain("describeSavedCleaningCatalog(");
    expect(route).toContain("enabledServices.length, supportedCleaningTypes");
    expect(route).toContain('label: "Cleaning service types"');
    expect(route).toContain("countDistinctSupportedCleaningTypes(serviceCatalog)");
    expect(route).not.toContain("No active service is saved.");
    const helper=readFileSync("src/features/onboarding/onboarding-cleaning-catalog-copy.ts","utf8");
    expect(helper).not.toContain(".rpc(");
    expect(helper).not.toContain("fetch(");
    expect(helper).not.toContain("createClient(");
  });
});
