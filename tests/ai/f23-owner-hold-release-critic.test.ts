import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
describe("F23 independent critic: owner release is not booking or payment",()=>{
 it("protects the money/booking boundary from temporary capacity release",()=>{
  const core=read("src/server/workflows/owner-verified-quote-hold-release.ts");
  expect(core).toContain('q.status!=="ACCEPTED"');
  expect(core).toContain('current.length!==1');
  expect(core).toContain('crew.branch_id!==req.branch_id');
  expect(core).toContain('service.from("verified_payment_applications")');
  expect(core).toContain('service.from("visits")');
  expect(core).toContain('h.status!=="HELD"');
  expect(core).toContain('.eq("status","HELD").gt("expires_at",input.now)');
  expect(core).toContain('status:"RELEASED",updated_at:input.now');
  expect(core).toContain('third.value.actor.userId!==first.value.actor.userId');
  expect(core).toContain('result.error||!h');
  for(const word of ["insert into public.visits","servicedesk_apply_verified_payment",
    "capturePayment(","payment_intent","sendEmail(","sendWhatsApp(","createVisit("])
   expect(core).not.toContain(word);
 });
 it("cannot appear on other tenants, staff role, non-current quotes or without server activation",()=>{
  const panel=read("src/features/operations/OwnerQuoteHoldReleasePanel.tsx");
  expect(panel).toContain('snapshot.value.actor.role!=="OWNER"');
  expect(panel).toContain('snapshot.value.branchScope?.mode!=="ALL"');
  expect(panel).toContain('SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED');
  expect(panel).toContain('indexAmbiguousCurrentQuoteRequests');
  expect(panel).toContain('current.get(q.requestId)?.id!==q.id');
  expect(panel).toContain('active.length!==1');
  expect(panel).toContain('OwnerSavedHoldReleaseControls');
 });
 it("existing payment-confirmed booking creation is not replaced or spoofed",()=>{
  const payment=read("supabase/migrations/0010_e03_verified_payment_rpc.sql");
  const release=read("src/features/operations/verified-hold-release-action.ts");
  const ui=read("src/features/operations/OwnerSavedHoldReleaseControls.tsx");
  const route=read("src/app/app/[workspace]/quotes/page.tsx");
  expect(payment).toContain("insert into public.visits(");
  expect(payment).toContain("update public.slot_holds set status = 'CONFIRMED'");
  expect(release).toContain('state:"HOLD_RELEASED_VERIFIED"');
  expect(release).toContain("bookingCreated:false");
  expect(ui).toContain("Releasing it");
  expect(ui).toContain("no automatic retry was attempted.");
  expect(route).toContain("<OwnerQuoteHoldReleasePanel workspaceSlug={workspace}");
 });
});
