import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseOwnerWorkflowSuggestion,parseOwnerWhatIfResponse,validateOwnerRuleIntent,
} from "../../src/features/operations/owner-rule-browser-proof";
import { previewOwnerWorkflowWhatIf } from "../../src/server/ai/workflow-what-if-preview";

const draft={
  state:"DRAFT_REQUIRES_OWNER_REVIEW",
  source:"UNTRUSTED_MODEL_SUGGESTION_STRICTLY_COMPILED",
  workspaceId:"workspace-qa",branchId:"branch-qa",
  eventType:"QUOTE_ACCEPTED",conditions:[
    {field:"request.serviceCode",operator:"EQ",value:"STANDARD"},
  ],
  actions:[{type:"CREATE_ATTENTION",severity:"WARNING",
    summaryKey:"AI_REVIEW_ACCEPTED_QUOTE"}],
  maxActionsPerEvent:1,published:false,requiresOwnerPublish:true,previewOnly:true,
  sendsCustomerMessages:false,mutatesFinancialState:false,
};
const response={
  state:"AI_RULE_DRAFT_OWNER_REVIEW_REQUIRED",
  source:"AUTHORIZED_OWNER_AND_SAVED_BRANCH",
  model:"gpt-safe-test",draft,executed:false,
};
const expected={workspaceId:"workspace-qa",branchId:"branch-qa"};
const previewBase={
  ok:true,state:"SYNTHETIC_RULE_PREVIEW_ONLY",
  inputSource:"OWNER_HYPOTHETICAL_NOT_SAVED_EVENT",
  eventType:"QUOTE_ACCEPTED",matched:true,wouldCreateAttention:true,
  checkedConditions:[{field:"request.serviceCode",matched:true}],
  conditionCount:1,executed:false,published:false,
  customerMessaged:false,paymentChanged:false,ownerPublishStillRequired:true,
};
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");

describe("R35 owner model workflow suggestion and real synthetic evaluator",()=>{
  it("accepts only the compiled owner+branch source, one harmless action",()=>{
    expect(parseOwnerWorkflowSuggestion(response,expected)).toEqual({
      model:"gpt-safe-test",workspaceId:"workspace-qa",branchId:"branch-qa",
      eventType:"QUOTE_ACCEPTED",severity:"WARNING",serviceCode:"STANDARD",
      source:"AUTHORIZED_OWNER_AND_SAVED_BRANCH",executed:false,published:false,
    });
    expect(parseOwnerWorkflowSuggestion(response,{...expected,branchId:"other-branch"}))
      .toBeNull();
    expect(parseOwnerWorkflowSuggestion({...response,executed:true},expected)).toBeNull();
    expect(parseOwnerWorkflowSuggestion({...response,draft:{...draft,published:true}},expected)).toBeNull();
    expect(parseOwnerWorkflowSuggestion({...response,privateCustomer:"secret"},expected)).toBeNull();
    expect(parseOwnerWorkflowSuggestion({...response,model:"untrusted\nsecret"},expected)).toBeNull();
    expect(parseOwnerWorkflowSuggestion({...response,draft:{...draft,
      actions:[{type:"SEND_WHATSAPP_TEMPLATE"}]}},expected)).toBeNull();
    expect(parseOwnerWorkflowSuggestion({...response,draft:{...draft,
      conditions:[{field:"request.serviceCode",operator:"EQ",value:"STANDARD",
        customerEmail:"private@example.test"}]}},expected)).toBeNull();
  });
  it("validates owner intent: no contact, numbers, prices, tokens or HTML",()=>{
    expect(validateOwnerRuleIntent("When a quote is accepted create an internal review."))
      .toBe("When a quote is accepted create an internal review.");
    for(const bad of ["call +12025550111","write to me@example.test",
      "send $100 invoice","token bearer secret","api key secret",
      "https://customer.example.test","<script>alert()</script>","short"]) {
      expect(validateOwnerRuleIntent(bad)).toBeNull();
    }
  });
  it("runs the real workflow rule evaluator only in synthetic preview",()=>{
    const raw={eventType:"QUOTE_ACCEPTED",severity:"WARNING",serviceCode:"STANDARD"};
    const scope={workspaceId:"workspace-qa",actorWorkspaceId:"workspace-qa",
      branchId:"branch-qa",role:"OWNER" as const};
    const matching=previewOwnerWorkflowWhatIf(raw,scope,{serviceCode:"STANDARD"});
    const different=previewOwnerWorkflowWhatIf(raw,scope,{serviceCode:"DEEP"});
    expect(matching.ok).toBe(true);
    expect(different.ok).toBe(true);
    if(!matching.ok || !different.ok)return;
    expect(matching.value).toMatchObject({state:"SYNTHETIC_RULE_PREVIEW_ONLY",
      matched:true,wouldCreateAttention:true,published:false,
      executed:false,customerMessaged:false,paymentChanged:false});
    expect(different.value).toMatchObject({matched:false,wouldCreateAttention:false});
    expect(parseOwnerWhatIfResponse(previewBase,{eventType:"QUOTE_ACCEPTED"})?.matched)
      .toBe(true);
    expect(parseOwnerWhatIfResponse({...previewBase,published:true},
      {eventType:"QUOTE_ACCEPTED"})).toBeNull();
    expect(parseOwnerWhatIfResponse({...previewBase,customerMessaged:true},
      {eventType:"QUOTE_ACCEPTED"})).toBeNull();
    expect(parseOwnerWhatIfResponse({...previewBase,privateReceipt:"FAKE"},
      {eventType:"QUOTE_ACCEPTED"})).toBeNull();
    expect(parseOwnerWhatIfResponse(previewBase,{eventType:"VISIT_COMPLETED"})).toBeNull();
  });
  it("stays owner-authorized and source-scoped at BOTH HTTP and preview boundaries",()=>{
    const server=read("src/features/operations/owner-rule-whatif-action.ts");
    const ui=read("src/features/operations/OwnerWorkflowRuleAssistant.tsx");
    const owner=read("src/features/operations/OwnerAutomationActivationChecklist.tsx");
    expect(server).toContain("resolveStaffActor(input.workspaceSlug)");
    expect(server).toContain('actor.role!=="OWNER"');
    expect(server).toContain('.eq("workspace_id",workspace.id)');
    expect(server).toContain('previewOwnerWorkflowWhatIf(input.candidate');
    expect(server).not.toContain(".insert(");
    expect(server).not.toContain(".update(");
    expect(ui).toContain('fetch("/api/internal/ai/workflow-suggestion"');
    expect(ui).toContain("branchId:selected,instruction:safeIntent");
    expect(ui).toContain("controller.signal.aborted || activeRequest.current!==controller");
    expect(ui).toContain("Stop waiting");
    expect(ui).toContain("requestOwnerWorkflowWhatIf(");
    expect(ui).toContain('sampleServiceCode:suggestion.serviceCode ? sampleCode : "NONE"');
    expect(ui).toContain("disabled={!suggestion?.serviceCode || previewBusy}");
    expect(ui).toContain("because it cannot change the rule decision.");
    expect(ui).toContain("Synthetic rule-engine preview completed");
    expect(ui).toContain("No draft row, live rule or customer");
    expect(owner).toContain('data.actor?.role');
    expect(owner).toContain("ownerRuleBranches");
    expect(owner).toContain("<OwnerWorkflowRuleAssistant");
    expect(ui).not.toContain("sendCustomerMessage(");
    expect(ui).not.toContain("publishOperationalWorkflowVersion(");
  });
  it("offers accessible touch/keyboard UI, honest preview and provider limitations",()=>{
    const css=read("src/features/operations/OwnerWorkflowRuleAssistant.module.css");
    const ui=read("src/features/operations/OwnerWorkflowRuleAssistant.tsx");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("min-height:44px");
    expect(css).toContain("@media(max-width:600px)");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(ui).toContain('aria-live="polite"');
    expect(ui).toContain("75 seconds");
    expect(ui).toContain("never a saved trigger");
    expect(ui).toContain("Publishing always happens separately");
    expect(ui).toContain("cannot reliably recognize every private name");
  });
});
