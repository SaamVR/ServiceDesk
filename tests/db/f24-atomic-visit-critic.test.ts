import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");

describe("F24 independent critic — no split-phase visit scheduling",()=>{
 it("requires a verified deposit, trusted atomic gateway, and both saved receipts",()=>{
  const core=read("src/server/core/visits.ts");
  expect(core).toContain("VERIFIED_DEPOSIT_REQUIRED");
  expect(core).toContain("ATOMIC_VISIT_UNAVAILABLE");
  expect(core).toContain("ATOMIC_VISIT_READBACK_INVALID");
  expect(core).toContain("commitScheduledVisit(visit, input.verifiedPaymentApplicationId, meta)");
  expect(core).toContain('confirmed.status !== "CONFIRMED"');
  expect(core).not.toContain("repository.confirmHold(");
  expect(core).not.toContain("repository.insertVisit(");
  const adapter=read("src/server/core/visit-repository.ts");
  expect(adapter).toContain("gateway.commitScheduledVisit(");
  expect(adapter).not.toContain("await gateway.confirmHold(");
  expect(adapter).not.toContain("await gateway.insertVisit(");
  expect(adapter).toContain('"ATOMIC_VISIT_UNAVAILABLE"');
  expect(adapter).toContain('"ATOMIC_VISIT_READBACK_INVALID"');
 });
 it("reuses real verified-payment SQL as authoritative booking path instead of inventing a second RPC",()=>{
  const migration=read("supabase/migrations/0010_e03_verified_payment_rpc.sql");
  const start=migration.indexOf("if v_purpose = 'DEPOSIT' then");
  const end=migration.indexOf("if v_purpose = 'BALANCE' then",start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const deposit=migration.slice(start,end);
  expect(deposit).toContain("for update");
  expect(deposit).toContain("insert into public.visits");
  expect(deposit).toContain("update public.slot_holds set status = 'CONFIRMED'");
  expect(deposit).toContain("insert into public.verified_payment_applications");
  expect(deposit).toContain("'APPLIED'");
  expect(migration).toContain("security invoker");
 });
 it("a temporary hold is not silently exposed as a booked visit",()=>{
  const ui=read("src/features/operations/VerifiedQuoteSlotHoldControls.tsx");
  const action=read("src/features/operations/verified-quote-slot-action.ts");
  expect(ui).toContain("A hold is not a booking or payment.");
  expect(action).toContain("bookingConfirmed:false");
  expect(action).toContain("paymentCaptured:false");
  const release=read("src/server/workflows/owner-verified-quote-hold-release.ts");
  expect(release).toContain("SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED");
 });
});
