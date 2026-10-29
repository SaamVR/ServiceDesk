import {describe,it,expect} from "vitest";
import {evaluateOwnerPricingScenarioMatrix} from "../../src/features/operations/owner-pricing-scenario-matrix";
import {evaluateOwnerPricingWorksheet} from "../../src/features/operations/owner-cleaning-pricing-worksheet";
import {readFileSync} from "node:fs";
function ownedForm(){
 const f=new FormData();
 const common={setupId:"11111111-1111-4111-8111-111111111111",
 branchId:"22222222-2222-4222-8222-222222222222",currency:"USD",
 nameStandard:"Standard clean",nameDeep:"Deep clean",nameMoveOut:"Move-out clean",
 depositPercent:"25",validHours:"48",bufferMinutes:"15",autoApprovalMax:"200.00"};
 for(const [k,v] of Object.entries(common))f.set(k,v);
 for(const p of ["standard","deep","moveOut"]){
  for(const [key,value] of Object.entries({Base:"125.25",BaseMinutes:"90",Bedroom:"20.00",
   BedroomMinutes:"15",Bathroom:"15.50",BathroomMinutes:"10"}))f.set(p+key,value);
 }
 f.set("moveOutOven","35.50");f.set("moveOutOvenMinutes","25");
 return f;
}
describe("P40 owner pricing scenario comparison",()=>{
 it("requires actual complete owner input, never invents prices",()=>{
  const f=ownedForm();f.delete("deepBase");
  expect(evaluateOwnerPricingScenarioMatrix(f,false).state).toBe("INCOMPLETE");
  f.set("deepBase","1e6");
  expect(evaluateOwnerPricingScenarioMatrix(f,false).state).toBe("INCOMPLETE");
  f.set("deepBase","125.25");f.set("currency","GBP");
  expect(evaluateOwnerPricingScenarioMatrix(f,false).state).toBe("INCOMPLETE");
  expect(evaluateOwnerPricingScenarioMatrix(f,undefined as unknown as boolean).state).toBe("INCOMPLETE");
 });
 it("uses exactly nine unpersisted scenarios and actual quote engine results",()=>{
  const form=ownedForm(),matrix=evaluateOwnerPricingScenarioMatrix(form,true);
  expect(matrix.state).toBe("READY");if(matrix.state!=="READY")return;
  expect(matrix).toMatchObject({source:"CURRENT_UNSAVED_OWNER_FORM",customerQuoteCreated:false,pricesSaved:false});
  expect(matrix.rows).toHaveLength(9);
  expect(new Set(matrix.rows.map(r=>r.key)).size).toBe(9);
  for(const row of matrix.rows){
   const direct=evaluateOwnerPricingWorksheet(form,{service:row.service,bedrooms:row.bedrooms,bathrooms:row.bathrooms,oven:row.oven});
   expect(direct.state).toBe("READY");
   if(direct.state==="READY")expect(row).toMatchObject({
    subtotalMinor:direct.value.subtotalMinor,depositMinor:direct.value.depositMinor,
    balanceMinor:direct.value.balanceMinor,durationMinutes:direct.value.durationMinutes,
    approval:direct.value.approval});
  }
 });
 it("isolates oven add-on and threshold without automatic approvals",()=>{
  const form=ownedForm(),base=evaluateOwnerPricingScenarioMatrix(form,false),
   oven=evaluateOwnerPricingScenarioMatrix(form,true);
  if(base.state!=="READY"||oven.state!=="READY")throw Error("complete form rejected");
  for(let i=0;i<9;i++){
   if(base.rows[i].service!=="MOVE_OUT")expect(oven.rows[i].subtotalMinor).toBe(base.rows[i].subtotalMinor);
   else expect(oven.rows[i].subtotalMinor-base.rows[i].subtotalMinor).toBe(3550);
  }
  expect(oven.rows.some(r=>r.approval==="REVIEW_THRESHOLD")).toBe(true);
 });
 it("is a connected browser-only worksheet, without persistence or provider code",()=>{
  const src=readFileSync("src/features/operations/OwnerCleaningPricingWorksheet.tsx","utf8");
  expect(src).toContain("evaluateOwnerPricingScenarioMatrix(values, oven)");
  expect(src).toContain('aria-label="Unsaved cleaning price scenario comparison"');
  expect(src).not.toContain("fetch(");
  const helper=readFileSync("src/features/operations/owner-pricing-scenario-matrix.ts","utf8");
  expect(helper).not.toContain("defaultRateCard");
  expect(helper).not.toContain("supabase");
 });
});
