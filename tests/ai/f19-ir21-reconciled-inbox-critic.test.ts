import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(path,"utf8");
const hash=(source:Buffer)=>createHash("sha1").update("blob "+source.length+"\0").update(source).digest("hex");
const imported=[
 ["src/server/ai/owner-inbox-request-rules.ts","012f493eac76b5f888510322bbb30a28c8b4404e"],
 ["src/features/operations/f19-inbox-request-rules-action.ts","87f16a1eea12f300aefb0c938ed5f966bd3fb679"],
 ["src/features/operations/AiInboxRequestRules.tsx","4602518cc5c76eb7369da739d3a797d8f9f56a46"],
 ["src/features/operations/inbox-request-rule-gate.ts","a4878db98f829e7a8bdd6756e52c47c242a95a04"],
 ["tests/ai/f19-inbox-request-rules.test.ts","68ec7dcbd9fef0f169fe4cb241ac85fa2683b676"],
 ["tests/ai/f19-inbox-request-rule-gate.test.ts","1bbcebc08c8305c2cba38901ea2afe6eac30fd2c"],
] as const;

describe("IR21+ Critic — reconciled source without losing existing protected Inbox",()=>{
 it("imports exact F19 source/test blobs from #913, no reimplementation",()=>{
  expect(imported).toHaveLength(6);
  for(const [path,sha] of imported)
   expect(hash(Buffer.from(read(path),"utf8")),path).toBe(sha);
 });
 it("retains existing protected F15 claim and owner-consented reply panels",()=>{
  const route=read("src/app/app/[workspace]/inbox/page.tsx");
  expect(hash(Buffer.from(route,"utf8"))).toBe("b68b99b3680b6f5ff4aa192a7cbda360715b1ef2");
  expect(route).toContain("<InboxConsentedDraftPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>");
  expect(route).toContain("<InboxProtectedLeadReviewPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>");
  expect(route).toContain("<InboxRequestRulesPanel workspaceSlug={workspace} selectedConversationId={query.conversation}/>");
  expect(route).not.toContain("<InboxLeadSlaPanel");
  const protectedPanel=read("src/features/operations/OwnerUnansweredLeadReview.tsx");
  expect(protectedPanel).toContain("Read saved owner-review journal");
  const newPanel=read("src/features/operations/InboxRequestRulesPanel.tsx");
  expect(newPanel).toContain('s.value.actor.role!=="OWNER"');
  expect(newPanel).toContain('s.value.branchScope?.mode!=="ALL"');
  expect(newPanel).toContain("canProcessSavedInboxRequestRules({");
  expect(newPanel).toContain("selectedConversationId");
  expect(newPanel).not.toContain(".insert(");
 });
 it("keeps F19 internal request execution disjoint from F15 protected escalation",()=>{
  const action=read("src/features/operations/f19-inbox-request-rules-action.ts");
  const server=read("src/server/ai/owner-inbox-request-rules.ts");
  const component=read("src/features/operations/AiInboxRequestRules.tsx");
  expect(action).toContain("processOwnerInboxRequestRules(workspaceSlug,conversationId)");
  expect(server).toContain("runOwnerSavedRequestAutomation");
  expect(server).toContain('v.state!=="PERSISTED_INTERNAL_WORKFLOW_PROCESSING"');
  expect(server).toContain('v.providerMessagesSent!==0');
  expect(component).toContain("not an unanswered-lead SLA event");
  for(const body of [action,server,component]){
   expect(body).not.toContain("sendWhatsapp(");
   expect(body).not.toContain("sendEmail(");
   expect(body).not.toContain("queueApprovedTemplate(");
   expect(body).not.toContain("servicedesk_claim_f15_unanswered_lead_sla_review");
  }
 });
});
