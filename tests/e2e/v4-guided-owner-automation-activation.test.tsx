import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { OperationalStaffSnapshot } from "../../src/features/operations/operational-product-runtime";
import { summarizeAutomationActivation } from "../../src/features/operations/owner-automation-activation";

const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const scope = {mode:"BRANCH" as const,selectedBranchId:"branch-1",branches:[
  {id:"branch-1",code:"US",name:"US",currency:"USD",timezone:"America/New_York",isDefault:true},
]};
const base = {
  branchScope:scope,
  serviceCatalog: [],
  ownerPricingBookProof:{state:"VERIFIED" as const,activeBranchIds:["branch-1"]},
  workflowAvailable:true,
  workflowRules:[],
  workflowRuleVersions:[],
  workflowExecutions:[],
  workflowActionExecutions:[],
};
type Snapshot = Parameters<typeof summarizeAutomationActivation>[0];
const steps=(snapshot:Snapshot)=>summarizeAutomationActivation(snapshot).steps
  .filter(step=>step.id!=="execution-proof" && step.status!=="READY");

describe("V4 guided owner quote automation activation",()=>{
  it("exposes real missing catalog and published rule before allowing first opt-in",()=>{
    const result=steps(base);
    expect(result.map(x=>x.id)).toEqual(["service-catalog","quote-rule"]);
    expect(result.every(step=>step.module==="settings" || step.module==="automations")).toBe(true);
  });

  it("does not require an execution before the owner can first activate",()=>{
    const complete:Snapshot={
      ...base,
      serviceCatalog:[{id:"svc-1",code:"STD",name:"Standard",active:true,requiresReview:false,updatedAt:"2026-10-13"}],
      workflowRules:[{id:"rule-1",branchId:"branch-1",code:"FOLLOWUP",name:"Followup",
        status:"ACTIVE",publishedVersionNumber:1,version:1,updatedAt:"2026-10-13"}],
      workflowRuleVersions:[{id:"v1",ruleId:"rule-1",branchId:"branch-1",versionNumber:1,
        state:"PUBLISHED",eventType:"QUOTE_ACCEPTED",conditions:[],
        actions:[{type:"CREATE_ATTENTION"}],maxActionsPerEvent:1,createdAt:"2026-10-13"}],
    };
    expect(steps(complete)).toEqual([]);
    expect(summarizeAutomationActivation(complete).steps[3].status).toBe("ACTION_REQUIRED");
  });

  it("renders actual requirements for authorized owner in BOTH automation studio states",()=>{
    const route=read("src/features/operations/OperationalProductRoute.tsx");
    const panel=read("src/features/operations/OwnerQuoteAcceptedAutomationControl.tsx");
    expect(route.match(/data.actor.role === "OWNER" \? <OwnerQuoteAcceptedAutomationControl/g)?.length)
      .toBe(2);
    expect(route.match(/<OwnerQuoteAcceptedAutomationControl workspaceSlug=\{workspaceSlug\} snapshot=\{data\}/g)?.length)
      .toBe(2);
    expect(panel).toContain("summarizeAutomationActivation(snapshot)");
    expect(panel).toContain('step.id !== "execution-proof"');
    expect(panel).toContain("missingSetup.length === 0");
    expect(panel).toContain("Before enabling automatic follow-up");
    expect(panel).toContain("Open Settings");
    expect(panel).toContain("Open Automation Studio");
    expect(panel).toContain("Opt-in unavailable until prerequisites are complete");
  });

  it("always keeps the disable control available and preserves protected server reauthorization",()=>{
    const panel=read("src/features/operations/OwnerQuoteAcceptedAutomationControl.tsx");
    expect(panel).toContain("enabled || missingSetup.length === 0");
    expect(panel).toContain("Disable automatic internal follow-up");
    expect(panel).toContain("setOwnerQuoteAutomationSetting(workspaceSlug, raw === \"true\", expectedVersion)");
    expect(panel).toContain("readOwnerQuoteAutomationSetting(workspaceSlug)");
    expect(panel).not.toContain('name="workspaceId"');
    expect(panel).not.toContain('name="actorId"');
  });
});
