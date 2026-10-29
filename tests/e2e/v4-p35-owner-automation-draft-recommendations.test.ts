import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { recommendOwnerAutomationDrafts } from "@/features/operations/owner-automation-draft-recommendations";
import { automationPlaybooks } from "@/features/operations/automation-playbooks";
import type { AutomationActivationSummary, ActivationStep } from "@/features/operations/owner-automation-activation";
import type { OwnerAttentionTriage } from "@/features/operations/owner-attention-triage";

const ids = ["service-catalog","pricing","quote-rule","accepted-quote","execution-proof"] as const;
const activation = (...states:ActivationStep["status"][]):AutomationActivationSummary=>({
  readyCount:states.filter(s=>s==="READY").length,total:5,allEvidenceReady:states.every(s=>s==="READY"),
  steps:ids.map((id,i)=>({id,title:id,status:states[i] ?? "UNVERIFIED",detail:"",module:"automations"})),
});
const attention:OwnerAttentionTriage={state:"AVAILABLE",open:0,overdue:0,critical:0,
  missingActionEvidence:0,ambiguous:0,closed:0,review:[]};
const suggest=(a:AutomationActivationSummary,t:OwnerAttentionTriage=attention,allowed=true)=>
  recommendOwnerAutomationDrafts({activation:a,attention:t,authorizedBranchKnown:allowed});

describe("P35 evidence-grounded internal draft starter recommendations",()=>{
  it("maps real owner blockers to existing supported, inert starter IDs only",()=>{
    const first=suggest(activation("ACTION_REQUIRED","UNVERIFIED","UNVERIFIED","UNVERIFIED","UNVERIFIED"));
    expect(first.map(x=>x.id)).toEqual(["new-enquiry"]);
    expect(suggest(activation("READY","UNVERIFIED","UNVERIFIED","UNVERIFIED","UNVERIFIED"))
      .map(x=>x.id)).toEqual(["branch-routing"]);
    expect(suggest(activation("READY","READY","ACTION_REQUIRED","UNVERIFIED","UNVERIFIED"))
      .map(x=>x.id)).toEqual(["quote-accepted"]);
    expect(suggest(activation("READY","READY","READY","READY","UNVERIFIED"))
      .map(x=>x.id)).toEqual(["attention-opened"]);
    for(const row of first) {
      expect(automationPlaybooks.some(x=>x.id===row.id && x.name===row.name)).toBe(true);
      expect(row.kind).toBe("OWNER_REVIEW_DRAFT_ONLY");
    }
  });
  it("prioritizes critical and missing evidence but never recommends execution or provider sends",()=>{
    const selected=suggest(activation("READY","READY","READY","READY","READY"),{
      ...attention,open:2,critical:1,missingActionEvidence:1,
    });
    expect(selected.map(x=>x.id)).toEqual(["critical-attention","warning-attention"]);
    expect(selected.every(x=>x.kind==="OWNER_REVIEW_DRAFT_ONLY")).toBe(true);
  });
  it("fails closed on missing branch authority, incomplete or contradictory step records",()=>{
    const normal=activation("READY","READY","ACTION_REQUIRED","ACTION_REQUIRED","UNVERIFIED");
    expect(suggest(normal,attention,false)).toEqual([]);
    expect(suggest({...normal,steps:[]},attention)).toEqual([]);
    expect(suggest({...normal,steps:[...normal.steps.slice(0,4),normal.steps[0]]},attention)).toEqual([]);
    expect(suggest({...normal,steps:[...normal.steps.slice(0,4),{
      ...normal.steps[4],status:"UNKNOWN" as ActivationStep["status"],
    }]},attention)).toEqual([]);
  });
  it("never generates an arbitrary recommendation or makes snapshot status ready",()=>{
    const base=activation("READY","READY","READY","READY","READY");
    const before=JSON.stringify(base);
    expect(suggest(base)).toEqual([]);
    expect(JSON.stringify(base)).toBe(before);
    expect(suggest(activation("READY","READY","UNVERIFIED","ACTION_REQUIRED","ACTION_REQUIRED"))
      .map(x=>x.id)).toEqual(["quote-accepted"]);
  });
  it("connects accessible owner review links without writing draft or making an external call",()=>{
    const ui=readFileSync("src/features/operations/OwnerAutomationActivationChecklist.tsx","utf8");
    expect(ui).toContain("recommendOwnerAutomationDrafts({");
    expect(ui).toContain("Suggested next internal workflow drafts");
    expect(ui).toContain('"?template=" + encodeURIComponent(item.id)');
    expect(ui).toContain('data.actor?.role === "OWNER" && draftStarters.length > 0');
    expect(ui).toContain("Reviewing a starter never publishes a rule");
  });
});
