import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
describe("F22 independent Critic: accepted-quote temporary hold business boundary",()=>{
 it("always uses existing trusted slot hold command, never invents booking/payment/provider",()=>{
  const source=read("src/server/workflows/owner-verified-quote-slot-hold.ts");
  expect(source).toContain("holdOperationalSlot");
  expect(source).toContain("(deps.hold??holdOperationalSlot)(slugValue,quoteId,slotId)");
  expect(source).toContain('q.status!=="ACCEPTED"');
  expect(source).toContain('crew.branch_id!==request.branch_id');
  expect(source).toContain("versions.data.length>=32");
  expect(source).toContain('service.from("slot_holds")');
  expect(source).toContain('result.data.length!==1');
  expect(source).toContain('h.status!=="HELD"');
  expect(source).toContain("third.value.actor.userId!==first.value.actor.userId");
  expect(source).toContain("bookingConfirmed:false");
  for(const forbidden of [".rpc(\"servicedesk_hold_slot\"","createVisit(","chargeCard(","sendEmail(",
    "sendWhatsApp(","createClient(","processPayment(",".insert(",".upsert("]){
   expect(source).not.toContain(forbidden);
  }
 });
 it("requires real server action and explicit operator click; never claims booking",()=>{
  const action=read("src/features/operations/verified-quote-slot-action.ts");
  const ui=read("src/features/operations/VerifiedQuoteSlotHoldControls.tsx");
  const panel=read("src/features/operations/OwnerQuoteCapacityHoldPanel.tsx");
  const route=read("src/app/app/[workspace]/quotes/page.tsx");
  expect(action).toContain('"use server"');
  expect(action).toContain("holdOwnerVerifiedQuoteSlot(workspaceSlug,quoteId,slotId)");
  expect(action).toContain("bookingConfirmed:false");
  expect(ui).toContain("onClick={()=>void hold(c.slotId)");
  expect(ui).toContain("A hold is not a booking or payment.");
  expect(ui).toContain("no automatic retry was attempted");
  expect(panel).toContain('loaded.value.branchScope?.mode!=="ALL"');
  expect(panel).toContain('q.status==="ACCEPTED"');
  expect(panel).toContain("indexAmbiguousCurrentQuoteRequests");
  expect(panel).toContain("new Set(data.crews.filter(c=>c.active&&c.branchId===request.branchId)");
  expect(route).toContain("<OwnerQuoteCapacityHoldPanel workspaceSlug={workspace} selectedQuoteId={query.quote}/>");
  for(const body of [action,ui,panel])expect(body).not.toContain("process.env.");
 });
 it("keeps saved first quote, existing staff Schedule and protected Inbox workflows",()=>{
  const quotes=read("src/app/app/[workspace]/quotes/page.tsx");
  const schedule=read("src/app/app/[workspace]/schedule/page.tsx");
  const inbox=read("src/app/app/[workspace]/inbox/page.tsx");
  expect(quotes).toContain("<OperationalProductRoute");
  expect(quotes).toContain("<QuoteRecoveryReadinessPanel");
  expect(schedule).toContain('module="schedule"');
  expect(inbox).toContain("<InboxProtectedLeadReviewPanel");
  expect(inbox).toContain("<InboxRequestRulesPanel");
  const first=read("src/server/ai/owner-inbox-first-quote.ts");
  expect(first).toContain("calculateOperationalQuote");
 });
});
