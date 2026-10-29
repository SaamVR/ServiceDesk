import { describe, expect, it } from "vitest";
import { summarizeAutomationActivation } from "../../src/features/operations/owner-automation-activation";
type Input=Parameters<typeof summarizeAutomationActivation>[0];

const branch={id:"north",code:"N",name:"North",currency:"USD",timezone:"UTC",isDefault:true};
const another={id:"south",code:"S",name:"South",currency:"USD",timezone:"UTC",isDefault:false};
const base:Input={
  branchScope:{mode:"BRANCH",selectedBranchId:"north",branches:[branch,another]},
  serviceCatalog:[],workflowAvailable:true,
  workflowRules:[],workflowRuleVersions:[],
  workflowExecutions:[],workflowActionExecutions:[],
  requests:[],quotes:[],attentionItems:[],
};
const standard={
  id:"saved-standard",code:"STANDARD",name:"Standard",active:true,
  requiresReview:false,updatedAt:"2026-10-29",
};
const status=(data:Input,id:string)=>
  summarizeAutomationActivation(data).steps.find(s=>s.id===id)?.status;

describe("P29 exact owner activation evidence",()=>{
 it("unrelated active services do not unlock cleaning automation readiness",()=>{
   const data={...base,serviceCatalog:[{...standard,code:"WINDOWS"}],
     ownerPricingBookProof:{state:"VERIFIED" as const,activeBranchIds:["north"],existingBookBranchIds:["north"]}};
   expect(status(data,"service-catalog")).toBe("ACTION_REQUIRED");
   expect(status({...data,serviceCatalog:[standard]},"service-catalog")).toBe("READY");
 });
 it("cannot claim a verified branch book from a label without an independent book inventory",()=>{
   const data={...base,serviceCatalog:[standard],
     ownerPricingBookProof:{state:"VERIFIED" as const,activeBranchIds:["north"]}};
   const result=summarizeAutomationActivation(data);
   expect(result.steps[1].status).toBe("UNVERIFIED");
   expect(result.steps[2].status).toBe("UNVERIFIED");
   expect(result.steps[3].status).toBe("UNVERIFIED");
   expect(result.steps[4].status).toBe("UNVERIFIED");
   expect(result.allEvidenceReady).toBe(false);
 });
 it("rejects contradictory active vs saved book IDs, even when labelled VERIFIED",()=>{
   const data={...base,serviceCatalog:[standard],
     ownerPricingBookProof:{state:"VERIFIED" as const,activeBranchIds:["north"],existingBookBranchIds:["south"]}};
   const result=summarizeAutomationActivation(data);
   expect(result.steps[1].status).toBe("UNVERIFIED");
   expect(result.readyCount).toBe(1);
 });
 it("isolates selected branch and does not accept a different saved USD branch",()=>{
   const data={...base,serviceCatalog:[standard],
     ownerPricingBookProof:{state:"VERIFIED" as const,activeBranchIds:["south"],existingBookBranchIds:["south"]}};
   expect(status(data,"pricing")).toBe("ACTION_REQUIRED");
   expect(status({...data,ownerPricingBookProof:{state:"VERIFIED",activeBranchIds:["north"],existingBookBranchIds:["north"]}},"pricing")).toBe("READY");
 });
});
