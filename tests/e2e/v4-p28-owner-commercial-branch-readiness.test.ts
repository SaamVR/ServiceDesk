import { describe, expect, it } from "vitest";
import { summarizeOwnerCommercialSetup } from "../../src/features/onboarding/onboarding-commercial-readiness";
import type {
  OperationalBranchScope, OperationalServiceCatalogItem,
} from "../../src/features/operations/operational-product-runtime";

const n = {id:"us-n",code:"N",name:"North",currency:"USD",timezone:"UTC",isDefault:true};
const s = {id:"us-s",code:"S",name:"South",currency:"USD",timezone:"UTC",isDefault:false};
const g = {id:"uk-g",code:"G",name:"London",currency:"GBP",timezone:"UTC",isDefault:false};
const scope:OperationalBranchScope={mode:"ALL",branches:[n,s,g]};
const catalog:OperationalServiceCatalogItem[]=[{
 id:"saved-standard",code:"STANDARD",name:"Standard cleaning",active:true,
 requiresReview:false,updatedAt:"2026-10-29"
}];

describe("P28 commercial onboarding: saved pricing proof is not a first-run authorization",()=>{
 it("reports invalid saved and genuinely missing books together, preserving both actions",()=>{
  const result=summarizeOwnerCommercialSetup({catalog,scope,
    proof:{state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:[n.id]}});
  expect(result).toMatchObject({
    state:"UNVERIFIED",eligibleUsdBranches:2,
    missingPriceBookBranches:1,repairPriceBookBranches:1,
  });
  expect(result.detail).toContain("North");
  expect(result.detail).toContain("first-run setup cannot overwrite");
  expect(result.detail).toContain("Separately, 1 other authorized USD branch");
  expect(result.detail).not.toContain("London");
 });
 it("never calls an unsupported GBP branch a missing USD price book",()=>{
  const result=summarizeOwnerCommercialSetup({
    catalog,scope:{mode:"BRANCH",selectedBranchId:g.id,branches:[n,s,g]},
    proof:{state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:[]},
  });
  expect(result).toMatchObject({
    state:"UNSUPPORTED_CURRENCY",eligibleUsdBranches:0,
    missingPriceBookBranches:0,repairPriceBookBranches:0
  });
 });
 it("fails closed for an independently missing inventory and contradictions",()=>{
  const proofs=[
    {state:"VERIFIED" as const,activeBranchIds:[n.id]},
    {state:"VERIFIED" as const,activeBranchIds:[n.id],existingBookBranchIds:[]},
    {state:"VERIFIED" as const,activeBranchIds:["foreign"],existingBookBranchIds:["foreign"]},
    {state:"VERIFIED" as const,activeBranchIds:[],existingBookBranchIds:["foreign"]},
  ];
  for(const proof of proofs){
    const value=summarizeOwnerCommercialSetup({catalog,scope,proof});
    expect(value).toMatchObject({
      state:"UNVERIFIED",missingPriceBookBranches:0,repairPriceBookBranches:0
    });
    expect(value.detail).toContain("Refresh Settings");
  }
 });
 it("distinguishes missing-only, repair-only and actually saved in-scope books",()=>{
  expect(summarizeOwnerCommercialSetup({catalog,scope,proof:{
    state:"VERIFIED",activeBranchIds:[],existingBookBranchIds:[]
  }})).toMatchObject({state:"NEEDS_PRICE_BOOK",missingPriceBookBranches:2,repairPriceBookBranches:0});
  expect(summarizeOwnerCommercialSetup({catalog,scope,proof:{
    state:"VERIFIED",activeBranchIds:[s.id],existingBookBranchIds:[n.id,s.id]
  }})).toMatchObject({state:"UNVERIFIED",missingPriceBookBranches:0,repairPriceBookBranches:1});
  expect(summarizeOwnerCommercialSetup({catalog,scope,proof:{
    state:"VERIFIED",activeBranchIds:[n.id,s.id],existingBookBranchIds:[n.id,s.id]
  }})).toMatchObject({state:"VERIFIED",missingPriceBookBranches:0,repairPriceBookBranches:0});
 });
 it("unrelated active services cannot create cleaning-service readiness",()=>{
  const unrelated:OperationalServiceCatalogItem[]=[{...catalog[0],code:"WINDOWS"}];
  expect(summarizeOwnerCommercialSetup({catalog:unrelated,scope,proof:{
    state:"VERIFIED",activeBranchIds:[n.id],existingBookBranchIds:[n.id]
  }})).toMatchObject({state:"NEEDS_SERVICE",quoteableCleaningServices:0});
 });
});
