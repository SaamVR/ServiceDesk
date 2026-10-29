import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planOwnerAutomationNextAction } from "../../src/features/operations/owner-automation-next-action";
import type { ActivationStepId, ActivationStatus, AutomationActivationSummary } from "../../src/features/operations/owner-automation-activation";

const ids: ActivationStepId[]=["service-catalog","pricing","quote-rule","accepted-quote","execution-proof"];
const modules=["settings","settings","automations","requests","automations"] as const;
const statuses=(list:ActivationStatus[]):AutomationActivationSummary=>{
  const steps=ids.map((id,i)=>({id,title:id,status:list[i],detail:"Saved "+id+" evidence",module:modules[i]}));
  return {readyCount:list.filter(s=>s==="READY").length,total:5,allEvidenceReady:list.every(s=>s==="READY"),steps};
};

describe("P33 owner-safe automation activation remediation planner",()=>{
  it("first resolves supported cleaning catalog before offering pricing or external workflow",()=>{
    const action=planOwnerAutomationNextAction(statuses([
      "ACTION_REQUIRED","ACTION_REQUIRED","ACTION_REQUIRED","ACTION_REQUIRED","ACTION_REQUIRED"
    ]),true);
    expect(action).toMatchObject({state:"ACTION_REQUIRED",stepId:"service-catalog",
      module:"settings",pricingAnchor:false,pendingCount:5,label:"Review cleaning catalog"});
  });
  it("deep-links only a genuinely missing verified price book, never a catalog or unavailable proof",()=>{
    const step=statuses(["READY","ACTION_REQUIRED","ACTION_REQUIRED","ACTION_REQUIRED","ACTION_REQUIRED"]);
    expect(planOwnerAutomationNextAction(step,true)).toMatchObject({
      state:"ACTION_REQUIRED",stepId:"pricing",pricingAnchor:true,pendingCount:4,
      label:"Enter actual branch rates"});
    expect(planOwnerAutomationNextAction(step,false)).toMatchObject({
      state:"ACTION_REQUIRED",stepId:"pricing",pricingAnchor:false,label:"Review saved pricing"});
    const missing=statuses(["READY","UNVERIFIED","ACTION_REQUIRED","ACTION_REQUIRED","ACTION_REQUIRED"]);
    const action=planOwnerAutomationNextAction(missing,true);
    expect(action).toMatchObject({state:"VERIFY_EVIDENCE",stepId:"pricing",pricingAnchor:false});
    expect(action.detail).toContain("Saved evidence is unavailable");
  });
  it("puts published workflow before customer acceptance, before internal execution",()=>{
    for(const [list,id,module] of [
      [["READY","READY","ACTION_REQUIRED","ACTION_REQUIRED","ACTION_REQUIRED"],"quote-rule","automations"],
      [["READY","READY","READY","ACTION_REQUIRED","ACTION_REQUIRED"],"accepted-quote","requests"],
      [["READY","READY","READY","READY","ACTION_REQUIRED"],"execution-proof","automations"]
    ] as const) {
      const action=planOwnerAutomationNextAction(statuses([...list]),true);
      expect(action.stepId).toBe(id);
      expect(action.module).toBe(module);
      expect(action.pricingAnchor).toBe(false);
    }
  });
  it("does not confuse source-linked all-ready with live QA, outbound delivery or payment proof",()=>{
    const action=planOwnerAutomationNextAction(statuses(ids.map(()=>"READY")),true);
    expect(action).toMatchObject({state:"SOURCE_READY",stepId:null,module:null,
      pricingAnchor:false,pendingCount:0,label:null});
    expect(action.detail).toContain("customer testing");
    expect(action.detail).toContain("payment and deployment");
  });
  it("fails closed if the owner checklist has missing, reordered or contradictory step IDs",()=>{
    const complete=statuses(ids.map(()=>"READY"));
    for(const broken of [
      {...complete,steps:complete.steps.slice(1)},
      {...complete,steps:[complete.steps[1],complete.steps[0],...complete.steps.slice(2)]},
      {...complete,steps:complete.steps.map((step,i)=>i===1?{...step,id:"service-catalog" as const}:step)}
    ]) {
      const action=planOwnerAutomationNextAction(broken,true);
      expect(action).toMatchObject({state:"VERIFY_EVIDENCE",pricingAnchor:false,
        stepId:"service-catalog",module:"settings",pendingCount:5});
      expect(action.detail).toContain("could not be reconciled");
    }
  });
  it("renders only authorized in-workspace navigation, with no direct mutation",()=>{
    const component=readFileSync("src/features/operations/OwnerAutomationActivationChecklist.tsx","utf8");
    const planner=readFileSync("src/features/operations/owner-automation-next-action.ts","utf8");
    expect(component).toContain("planOwnerAutomationNextAction(summary, canOpenPricingForm)");
    expect(component).toContain('aria-label="Next safe owner action"');
    expect(component).toContain("buildStaffModuleHref(workspaceSlug, nextAction.module)");
    expect(component).toContain("nextAction.pricingAnchor");
    expect(component).toContain("not a live-provider or customer-session launch approval");
    expect(planner).not.toContain(".rpc(");
    expect(planner).not.toContain("fetch(");
    expect(planner).not.toContain("service_role");
  });
});
