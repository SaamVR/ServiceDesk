import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
describe("F21 independent Critic — exact Inbox first-quote without invented prices or send",()=>{
 it("uses existing trusted quote pricing persistence and saved-row readback",()=>{
  const s=read("src/server/ai/owner-inbox-first-quote.ts");
  expect(s).toContain("calculateOperationalQuote");
  expect(s).toContain("(deps.calculate??calculateOperationalQuote)");
  expect(s).toContain('service.from("quotes")');
  expect(s).toContain('quotes.data.length!==0');
  expect(s).toContain('result.data.length!==1');
  expect(s).toContain("q.subtotal_minor+q.tax_minor!==q.total_minor");
  expect(s).toContain('second.value.actor.userId!==first.value.actor.userId');
  expect(s).toContain('third.value.actor.userId!==first.value.actor.userId');
  for(const forbidden of [
   "sendQuote(","sendWhatsapp(","sendEmail(","createQuoteSnapshot(",
   "servicedesk_persist_quote_snapshot", "queueApprovedTemplate(",
   "payment_intents","const fallbackRate",
  ])expect(s).not.toContain(forbidden);
 });
 it("requires explicit saved Inbox selection and never invokes pricing on render",()=>{
  const panel=read("src/features/operations/InboxRequestRulesPanel.tsx");
  const ui=read("src/features/operations/InboxFirstQuoteAction.tsx");
  const action=read("src/features/operations/inbox-first-quote-action.ts");
  expect(panel).toContain("<InboxFirstQuoteAction workspaceSlug={workspaceSlug} conversationId={conversation.id}/>");
  expect(panel).toContain("canOfferFirstInboxQuote({");
  expect(panel).toContain("Review saved branch pricing");
  expect(ui).toContain("Calculate saved first quote");
  expect(ui).toContain("onClick={()=>void submit()");
  expect(action).toContain('"use server"');
  expect(action).toContain("calculateOwnerInboxFirstQuote(workspaceSlug,conversationId)");
  expect(ui).toContain("booking created or payment recorded");
  for(const s of [action,ui])expect(s).not.toContain("process.env.");
 });
 it("retains protected F15 V3, F19 internal attention, F18 consent and F20 owner journeys",()=>{
  const route=read("src/app/app/[workspace]/inbox/page.tsx");
  expect(route).toContain("<InboxProtectedLeadReviewPanel");
  expect(route).toContain("<InboxConsentedDraftPanel");
  expect(route).toContain("<InboxRequestRulesPanel");
  const panel=read("src/features/operations/InboxRequestRulesPanel.tsx");
  expect(panel).toContain("<AiInboxRequestRules");
  expect(panel).toContain('s.value.actor.role!=="OWNER"');
  expect(panel).toContain('s.value.branchScope?.mode!=="ALL"');
  const sql=read("docs/engineering/security/f15-unanswered-lead-atomic-attention-v3.sql");
  expect(sql).toContain("UNANSWERED_LEAD_SLA");
 });
});
