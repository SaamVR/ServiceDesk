import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeAutomationActivation } from "../../src/features/operations/owner-automation-activation";
import { buildStaffModuleHref } from "../../src/features/operations/staff-modules";

const route=readFileSync(join(process.cwd(),
  "src/features/onboarding/OnboardingProductRoute.tsx"),"utf8");

describe("V4 first-run real automation checklist in owner onboarding",()=>{
  it("shows five real saved-data checks including customer acceptance",()=>{
    const snapshot={
      serviceCatalog:[],
      branchScope:{mode:"BRANCH" as const,selectedBranchId:"branch-a",branches:[{
        id:"branch-a",code:"US-A",name:"New York",currency:"USD",
        timezone:"America/New_York",isDefault:true,
      }]},
      ownerPricingBookProof:{state:"VERIFIED" as const,activeBranchIds:[]},
      workflowAvailable:true,
      workflowRules:[],workflowRuleVersions:[],
      workflowExecutions:[],workflowActionExecutions:[],
    };
    const summary=summarizeAutomationActivation(snapshot);
    expect(summary.total).toBe(5);
    expect(summary.readyCount).toBe(0);
    expect(summary.allEvidenceReady).toBe(false);
    expect(summary.steps.map(x=>x.id)).toEqual([
      "service-catalog","pricing","quote-rule","accepted-quote","execution-proof",
    ]);
    expect(summary.steps.every(step=>step.status!=="READY")).toBe(true);
    expect(route).toContain("summarizeAutomationActivation(result.value)");
    expect(route).toContain("automationActivation.readyCount");
    expect(route).toContain("automationActivation.total");
  });

  it("guides an owner to the real settings and automation modules in their workspace",()=>{
    expect(buildStaffModuleHref("qa-cleaning","settings")).toBe("/app/qa-cleaning/settings");
    expect(buildStaffModuleHref("qa-cleaning","automations")).toBe("/app/qa-cleaning/automations");
    expect(route).toContain("buildStaffModuleHref(workspace.slug, step.module)");
    expect(route).toContain("Turn on a real internal cleaning automation");
    expect(route).toContain("Review Settings");
    expect(route).toContain("Open Automation Studio");
    expect(route).toContain("Review customer requests");
    expect(route).toContain("Only workspace owners can enable");
    expect(route).toContain('step.status === "UNVERIFIED"');
  });

  it("does not promise model calls, payment or external message delivery",()=>{
    expect(route).toContain("A configured trigger or draft rule never proves an AI model call");
    expect(route).toContain("a complete customer workflow");
    expect(route).toContain("A completed internal attention receipt is separate evidence.");
    expect(route).not.toContain("Email delivered successfully");
    expect(route).not.toContain("Automations ready to send");
  });

  it("preserves existing owner/session and branch-scope authorization boundaries",()=>{
    expect(route).toContain("loadOnboardingProduct(workspaceSlug)");
    expect(route).toContain("OnboardingOperationalEvidencePanel");
    expect(route).toContain("ownerPricingBookProof");
    expect(route).toContain("workspace.slug");
    expect(route).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
