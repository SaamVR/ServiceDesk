import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const file=(path:string)=>readFileSync(path,"utf8");
describe("F19 independent security Critic: authenticated Inbox → request execution",()=>{
 it("uses reviewed request executor rather than inventing an attention insertion API",()=>{
  const s=file("src/server/ai/owner-inbox-request-rules.ts");
  expect(s).toContain('runOwnerSavedRequestAutomation');
  expect(s).toContain('result=await (deps.executeRequest??runOwnerSavedRequestAutomation)(workspaceSlug,a.requestId)');
  expect(s).toContain('v.state!=="PERSISTED_INTERNAL_WORKFLOW_PROCESSING"');
  expect(s).toContain('v.providerMessagesSent!==0');
  expect(s).toContain('!owner(second,workspaceSlug)');
  expect(s).toContain('b.fingerprint!==a.fingerprint');
  expect(s).toContain('a.requestId');
  for(const disallowed of [".insert(", ".upsert(", "queueApprovedTemplate(",
   "sendEmail(","sendWhatsApp(","servicedesk_claim_f15_unanswered_lead_sla_review",
   "process.env."]){
   expect(s).not.toContain(disallowed);
  }
 });
 it("shows an explicit owner click and refuses to portray a request event as SLA",()=>{
  const action=file("src/features/operations/f19-inbox-request-rules-action.ts");
  const ui=file("src/features/operations/AiInboxRequestRules.tsx");
  const panel=file("src/features/operations/InboxLeadSlaPanel.tsx");
  expect(action).toContain('"use server"');
  expect(action).toContain("processOwnerInboxRequestRules(workspaceSlug,conversationId)");
  expect(action).toContain("externalMessagesSent:0");
  expect(ui).toContain("Process published request rules");
  expect(ui).toContain("not an unanswered-lead SLA event");
  expect(ui).toContain('key={workspaceSlug+":"+conversationId}');
  expect(ui).toContain("externalMessagesSent!==0");
  expect(panel).toContain("<AiInboxRequestRules workspaceSlug={workspaceSlug} conversationId={selected.id}/>");
  for(const s of [action,ui]){
   expect(s).not.toContain("fetch(");
   expect(s).not.toContain(".insert(");
   expect(s).not.toContain("process.env.");
  }
 });
 it("keeps original F18/F15 Inbox staff journeys and source owner scopes unchanged",()=>{
  const panel=file("src/features/operations/InboxLeadSlaPanel.tsx");
  const route=file("src/app/app/[workspace]/inbox/page.tsx");
  const requestExecutor=file("src/server/workflows/owner-request-automation.ts");
  expect(panel).toContain('result.value.actor.role!=="OWNER"');
  expect(panel).toContain('result.value.branchScope?.mode!=="ALL"');
  expect(panel).toContain("<AiUnansweredLeadSlaReview workspaceSlug={workspaceSlug} conversationId={selected.id}/>");
  expect(route).toContain("<InboxConsentedDraftPanel");
  expect(route).toContain("<InboxLeadSlaPanel");
  expect(requestExecutor).toContain('sourceEventId: requestId');
  expect(requestExecutor).toContain('eq("action_type", "CREATE_ATTENTION")');
  expect(requestExecutor).not.toContain("queueApprovedTemplate(");
 });
});
