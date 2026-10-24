import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {compileModelWorkflowDraft} from "../../src/server/ai/workflow-draft-proposal";
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
describe("R36 real owner-reviewed AI workflow DRAFT persistence",()=>{
  it("keeps all write authorization on server and revalidates actual owner scope",()=>{
    const src=read("src/features/operations/owner-rule-save-action.ts");
    expect(src).toContain("resolveStaffActor(input.workspaceSlug)");
    expect(src).toContain('actor.role!=="OWNER"');
    expect(src).toContain("actorWorkspaceId:actor.workspaceId");
    expect(src).toContain("branchScope.selectedBranchId!==input.branchId");
    expect(src).toContain("compileModelWorkflowDraft(input.candidate");
    expect(src).toContain("saveOperationalWorkflowDraft(input.workspaceSlug");
    expect(src).toContain('operationalDatabaseMode()!=="SERVICE_ROLE"');
    expect(src).toContain('compiled.value.actions[0]?.type!=="CREATE_ATTENTION"');
    expect(src).toContain("maxActionsPerEvent:1");
    expect(src).not.toContain("publishOperationalWorkflowVersion(");
    expect(src).not.toContain("executeOperationalWorkflowAttentionAction(");
    expect(src).not.toContain("sendCustomerMessage(");
  });
  it("requires exact hypothetical preview plus human review before save click",()=>{
    const ui=read("src/features/operations/OwnerWorkflowRuleAssistant.tsx");
    expect(ui).toContain("I reviewed the exact compiled rule");
    expect(ui).toContain("!suggestion || !preview || !reviewConfirmed");
    expect(ui).toContain("saveOwnerReviewedWorkflowDraft({");
    expect(ui).toContain('response.state!=="DRAFT_SAVED_OWNER_PREVIEW_REQUIRED"');
    expect(ui).toContain("setReviewConfirmed(false)");
    expect(ui).toContain("savePending.current=true");
    expect(ui).toContain("!saving && !draftSaved");
    expect(ui).toContain("!draftWritable || savePending.current");
    expect(ui).toContain("The saved workflow draft backend is unavailable");
    expect(ui).toContain("disabled={!draftWritable || !preview");
    expect(ui).toContain("new paid model request is disabled");
    expect(ui).toContain("at most 24 authorized branches");
    expect(ui).toContain("!draftWritable || savePending.current || !suggestion");
    expect(ui).toContain("savePending.current=false");
    expect(ui).toContain("draftSaved");
    expect(ui).toContain("before retrying to avoid duplicate drafts");
    expect(ui).toContain("Open the saved workflow builder");
    expect(ui).toContain("No workflow event or customer delivery was executed");
  });
  it("separately rejects extra model tools and financial fields on the trusted compiler",()=>{
    const scope={workspaceId:"workspace-qa",actorWorkspaceId:"workspace-qa",branchId:"branch-qa",role:"OWNER" as const};
    const valid={eventType:"QUOTE_ACCEPTED",severity:"WARNING"};
    expect(compileModelWorkflowDraft(valid,scope).ok).toBe(true);
    expect(compileModelWorkflowDraft({...valid,recipient:"customer@example.test"},scope).ok).toBe(false);
    expect(compileModelWorkflowDraft({...valid,actionType:"SEND_EMAIL_TEMPLATE"},scope).ok).toBe(false);
    expect(compileModelWorkflowDraft({...valid,payment:123},scope).ok).toBe(false);
  });
  it("remains mobile keyboard-usable with visible operator confirmation",()=>{
    const css=read("src/features/operations/OwnerWorkflowRuleAssistant.module.css");
    expect(css).toContain(".reviewControl input");
    expect(css).toContain("min-height:44px");
    expect(css).toContain("focus-visible");
    expect(css).toContain("@media(max-width:600px)");
  });
});
