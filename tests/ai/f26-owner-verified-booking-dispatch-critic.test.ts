import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
describe("F26 independent critic: paid visit dispatch vs booked payment and calendar delivery",()=>{
 it("reuses an existing saved booking + deposit and a protected existing ASSIGN command",()=>{
  const backend=read("src/server/workflows/owner-verified-booking-dispatch.ts");
  const payment=read("supabase/migrations/0010_e03_verified_payment_rpc.sql");
  const transition=read("supabase/migrations/0011_visit_field_runtime.sql");
  expect(backend).toContain("loadOwnerSavedBookingReceipt");
  expect(backend).toContain("transitionOperationalVisit");
  expect(backend).toContain('"ASSIGN"');
  expect(backend).toContain('before.value.recordedDepositApplication!==true');
  // The second saved source read must retain the FULL F25 paid-booking
  // evidence; matching only visit/invoice identifiers is not sufficient.
  expect(backend).toContain('checked.value.state!=="SAVED_BOOKING_WITH_APPLIED_DEPOSIT"');
  expect(backend).toContain('checked.value.quoteId!==quoteId');
  expect(backend).toContain('checked.value.recordedDepositApplication!==true');
  expect(backend).toContain('checked.value.bookingRecordPresent!==true');
  expect(backend).toContain('after.value.visitStatus!=="ASSIGNED"');
  expect(backend).toContain('third.value.actor.userId!==first.value.actor.userId');
  expect(payment).toContain("insert into public.visits(");
  expect(transition).toContain("if v_action = 'CONFIRM' then");
  expect(transition).toContain("elsif v_action = 'ASSIGN' then");
  expect(transition).toContain("calendar.visit.upsert");
  for(const forbidden of ["createVisit(","applyPayment(","processPayment(",
   "sendEmail(","sendWhatsApp(","createClient(","insert into public.visits"]){
   expect(backend).not.toContain(forbidden);
  }
 });
 it("owner-only and rollout-off unless explicitly enabled",()=>{
  const backend=read("src/server/workflows/owner-verified-booking-dispatch.ts");
  const action=read("src/features/operations/owner-verified-dispatch-action.ts");
  const component=read("src/features/operations/OwnerVerifiedBookingDispatchControls.tsx");
  const parent=read("src/features/operations/OwnerSavedBookingReceiptPanel.tsx");
  expect(backend).toContain('SERVICEDESK_F26_OWNER_DISPATCH_ENABLED');
  expect(backend).toContain('actor.role==="OWNER"');
  expect(backend).toContain('branchScope.mode==="ALL"');
  expect(backend).toContain('value.visitStatus!=="SCHEDULED"');
  expect(action).toContain('"use server"');
  expect(component).toContain("no automatic retry was attempted");
  expect(component).toContain("Calendar delivery remains unverified");
  expect(parent).toContain('process.env.SERVICEDESK_F26_OWNER_DISPATCH_ENABLED==="true"');
  expect(parent).toContain('v.visitStatus==="SCHEDULED"');
 });
 it("preserves F24 atomic payment booking and F25 saved receipt without changing routes",()=>{
  const visits=read("src/server/core/visits.ts");
  const receipt=read("src/server/ai/owner-saved-booking-receipt.ts");
  const route=read("src/app/app/[workspace]/quotes/page.tsx");
  expect(visits).toContain("commitScheduledVisit");
  expect(receipt).toContain('"SAVED_BOOKING_WITH_APPLIED_DEPOSIT"');
  expect(route).toContain("<OwnerSavedBookingReceiptPanel");
 });
});
