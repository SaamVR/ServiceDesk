import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { verifiedStaffInvoiceReminder } from "../../src/features/operations/staff-invoice-manual-reminder";

const facts={
  id:"11111111-1111-4111-8111-111111111111",
  status:"PARTIALLY_PAID",currency:"USD",
  quoteStatus:"ACCEPTED",quoteCurrency:"USD",
  totalMinor:24000,allocatedMinor:10000,refundedMinor:1000,balanceMinor:15000,
};
const host="https://servicedesk-v3-frontend-review.onrender.com";
describe("verified human-only invoice follow-up",()=>{
  test("contains the current refund-adjusted balance and authenticated portal URL",()=>{
    const text=verifiedStaffInvoiceReminder(facts,host);
    expect(text).toContain("Current saved outstanding balance: $150.00");
    expect(text).toContain("Recorded refunds: $10.00");
    expect(text).toContain(host+"/portal/invoices/"+facts.id);
    expect(text).toContain("after signing in");
    expect(text).toContain("not a booking confirmation or payment receipt");
  });
  test("blocks unaccepted quote, bad currency, draft or inconsistent ledger",()=>{
    for(const bad of [
      {quoteStatus:"SENT"},{quoteCurrency:"EUR"},{status:"DRAFT"},
      {balanceMinor:14000},{refundedMinor:2000},{allocatedMinor:8000},
      {currency:"usd"},{id:"attacker-controlled"}, {totalMinor:Number.NaN},
    ])expect(verifiedStaffInvoiceReminder({...facts,...bad},host)).toBeNull();
  });
  test("does not generate customer-facing links to untrusted or token-bearing origins",()=>{
    for(const origin of [
      "http://attacker.example",
      "https://attacker.example/path",
      "https://attacker.example/?secret=token",
      "https://username:password@attacker.example",
    ]) expect(verifiedStaffInvoiceReminder(facts,origin)).toBeNull();
  });
  test("staff component is explicitly manual and never invokes provider dispatch",()=>{
    const src=readFileSync(join(process.cwd(),"src/features/operations/StaffInvoiceManualReminder.tsx"),"utf8");
    const page=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
    expect(src).toContain("navigator.clipboard.writeText");
    expect(src).toContain("no delivery receipt exists");
    expect(src).not.toContain("fetch(");
    expect(page).toContain("<StaffInvoiceManualReminder invoice={{");
    expect(page).toContain("isVerifiedStaffCollectibleInvoice(selectedInvoice)");
  });
});
