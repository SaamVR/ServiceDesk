import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
describe("F25 independent security Critic — truthful saved booking receipts",()=>{
 it("requires exact saved APPLIED deposit, CONFIRMED hold, visit and invoice",()=>{
  const s=read("src/server/ai/owner-saved-booking-receipt.ts");
  expect(s).toContain('q.status!=="ACCEPTED"');
  expect(s).toContain('h.status!=="CONFIRMED"');
  expect(s).toContain('!statusSet.has(v.status)');
  expect(s).toContain('invoice.visit_id!==v.id');
  expect(s).toContain('invoice.allocated_minor-invoice.refunded_minor<q.deposit_minor');
  expect(s).toContain('p.purpose!=="DEPOSIT"');
  expect(s).toContain('p.state!=="APPLIED"');
  expect(s).toContain('p.amount_minor!==q.deposit_minor');
  expect(s).toContain('second.fingerprint!==first.fingerprint');
  expect(s).toContain('b.value.actor.userId!==a.value.actor.userId');
  expect(s).toContain('r.value.actor.role==="OWNER"');
  expect(s).toContain('r.value.branchScope.mode==="ALL"');
  expect(s).toContain('customerMessageSent:false,newPaymentProcessed:false,newBookingCreated:false');
  for(const invalid of [".insert(", ".upsert(", ".update(", ".rpc(", "sendEmail(",
    "sendWhatsApp(", "createPaymentIntent(", "process.env.NEXT_PUBLIC_"])
    expect(s).not.toContain(invalid);
 });
 it("does not mistake a temporary hold for a paid visit or expose provider data",()=>{
  const component=read("src/features/operations/OwnerSavedBookingReceiptPanel.tsx");
  const quote=read("src/app/app/[workspace]/quotes/page.tsx");
  expect(quote).toContain("<OwnerSavedBookingReceiptPanel");
  expect(component).toContain("loadOwnerSavedBookingReceipt(workspaceSlug,selectedQuoteId)");
  expect(component).toContain("The saved deposit application, confirmed hold, scheduled visit and invoice");
  expect(component).toContain("not a new payment or confirmation action");
  expect(component).not.toContain("providerAccountId");
  expect(component).not.toContain("transactionId");
  const hold=read("src/features/operations/VerifiedQuoteSlotHoldControls.tsx");
  expect(hold).toContain("A hold is not a booking or payment.");
 });
 it("preserves the existing verified-deposit booking transaction",()=>{
  const sql=read("supabase/migrations/0010_e03_verified_payment_rpc.sql");
  const first=sql.indexOf("if v_purpose = 'DEPOSIT' then");
  const end=sql.indexOf("if v_purpose = 'BALANCE' then",first);
  expect(first).toBeGreaterThan(0);
  const deposit=sql.slice(first,end);
  expect(deposit).toContain("insert into public.visits");
  expect(deposit).toContain("update public.slot_holds set status = 'CONFIRMED'");
  expect(deposit).toContain("'APPLIED'");
 });
});
