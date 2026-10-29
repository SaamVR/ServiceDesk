import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildOwnerActivationNextAction } from "../../src/features/operations/owner-activation-next-action";
import type { AutomationActivationSummary, ActivationStatus } from "../../src/features/operations/owner-automation-activation";

const entries = [
  ["service-catalog", "Catalog", "settings"],
  ["pricing", "Pricing", "settings"],
  ["quote-rule", "Rule", "automations"],
  ["accepted-quote", "Acceptance", "requests"],
  ["execution-proof", "Execution", "automations"],
] as const;
function summary(statuses:readonly ActivationStatus[]): AutomationActivationSummary {
  const steps=entries.map(([id,title,module],i)=>({
    id,title,detail:"Review saved " + title,status:statuses[i],module,
  }));
  const readyCount=steps.filter(s=>s.status==="READY").length;
  return {readyCount,total:5,allEvidenceReady:readyCount===5,steps};
}
const ready:ActivationStatus="READY", action:ActivationStatus="ACTION_REQUIRED",
  unknown:ActivationStatus="UNVERIFIED";
const safe=(result:ReturnType<typeof buildOwnerActivationNextAction>)=>{
  expect(result).toMatchObject({
    providerDeliveryVerified:false,liveDeploymentAuthorized:false,
  });
  expect(result.anchor).toMatch(/^$|^#owner-first-run-pricing$/);
};
describe("P33: actionable owner automation activation navigation",()=>{
  it("routes missing service catalog to catalog, never pricing worksheet",()=>{
    const result=buildOwnerActivationNextAction(summary([action,action,action,unknown,unknown]),true);
    expect(result).toMatchObject({state:"SETUP_REQUIRED",
      stepId:"service-catalog",module:"settings",
      linkLabel:"Review cleaning service catalog",anchor:"",readyForOwnerOptIn:false});
    safe(result);
  });
  it("links to actual first-run pricing only on an independently offered USD price form",()=>{
    const data=summary([ready,action,action,unknown,unknown]);
    const offered=buildOwnerActivationNextAction(data,true);
    expect(offered).toMatchObject({stepId:"pricing",linkLabel:"Enter actual USD prices",
      module:"settings",anchor:"#owner-first-run-pricing"});
    const existingBook=buildOwnerActivationNextAction(data,false);
    expect(existingBook).toMatchObject({stepId:"pricing",linkLabel:"Review saved branch pricing",anchor:""});
    safe(offered);safe(existingBook);
  });
  it("does not deep-link to an unavailable price form or pretend UNVERIFIED is action-ready",()=>{
    const result=buildOwnerActivationNextAction(summary([ready,unknown,action,unknown,unknown]),true);
    expect(result).toMatchObject({state:"VERIFY_SAVED_EVIDENCE",
      stepId:"pricing",anchor:"",readyForOwnerOptIn:false});
    expect(result.detail).toContain("No positive readiness");
    safe(result);
  });
  it("requires published rule before opt-in but not customer acceptance or live execution",()=>{
    const rule=buildOwnerActivationNextAction(summary([ready,ready,action,unknown,unknown]),false);
    expect(rule).toMatchObject({state:"SETUP_REQUIRED",stepId:"quote-rule",
      readyForOwnerOptIn:false,module:"automations"});
    const outcome=buildOwnerActivationNextAction(summary([ready,ready,ready,action,unknown]),false);
    expect(outcome).toMatchObject({state:"REVIEW_LIVE_RECEIPT",stepId:"accepted-quote",
      readyForOwnerOptIn:true,module:"requests"});
    const receipt=buildOwnerActivationNextAction(summary([ready,ready,ready,ready,unknown]),false);
    expect(receipt).toMatchObject({state:"VERIFY_SAVED_EVIDENCE",
      stepId:"execution-proof",readyForOwnerOptIn:true,module:"automations"});
    safe(rule);safe(outcome);safe(receipt);
  });
  it("all source-green still does not assert provider delivery or deployment permission",()=>{
    const result=buildOwnerActivationNextAction(summary([ready,ready,ready,ready,ready]),false);
    expect(result).toMatchObject({state:"SOURCE_READY_NOT_DEPLOYED",stepId:null,
      readyForOwnerOptIn:true});
    expect(result.detail).toContain("does not activate delivery");
    safe(result);
  });
  it("fails closed on contradictory count, duplicate step, foreign module or missing evidence",()=>{
    const cases:AutomationActivationSummary[]=[
      {...summary([ready,ready,ready,ready,ready]),readyCount:0},
      {...summary([ready,ready,ready,ready,ready]),allEvidenceReady:false},
      {...summary([ready,ready,ready,ready,ready]),steps:[]},
      {...summary([ready,ready,ready,ready,ready]),steps:[
        ...summary([ready,ready,ready,ready,ready]).steps.slice(0,4),
        summary([ready,ready,ready,ready,ready]).steps[0],
      ]},
      {...summary([ready,ready,ready,ready,ready]),steps:[
        {...summary([ready,ready,ready,ready,ready]).steps[0],module:"automations"},
        ...summary([ready,ready,ready,ready,ready]).steps.slice(1),
      ] as AutomationActivationSummary["steps"]},
    ];
    for(const candidate of cases){
      const x=buildOwnerActivationNextAction(candidate,true);
      expect(x).toMatchObject({state:"VERIFY_SAVED_EVIDENCE",
        readyForOwnerOptIn:false,anchor:""});
      safe(x);
    }
  });
  it("both owner-only panels use the same next-action helper and safe anchors",()=>{
    const checklist=readFileSync("src/features/operations/OwnerAutomationActivationChecklist.tsx","utf8");
    const setting=readFileSync("src/features/operations/OwnerQuoteAcceptedAutomationControl.tsx","utf8");
    expect(checklist).toContain("buildOwnerActivationNextAction(summary, canOpenPricingForm)");
    expect(setting).toContain("buildOwnerActivationNextAction(activation, canOpenFirstRunPricing)");
    expect(checklist).toContain('aria-labelledby="owner-activation-next-action"');
    expect(setting).toContain('aria-label="First actionable owner activation step"');
    for(const source of [checklist,setting]){
      expect(source).toContain('step.id === "pricing" && step.status === "ACTION_REQUIRED"');
      expect(source).toContain("nextAction.anchor");
    }
    expect(setting).toContain('enabled || (journalReady && missingSetup.length === 0)');
    expect(setting).toContain("Disable automatic internal follow-up");
  });
});
