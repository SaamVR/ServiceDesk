import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  staffInvoiceReminderScopeKey, verifiedStaffInvoiceReminder,
} from "../../src/features/operations/staff-invoice-manual-reminder";

const input={
  id:"11111111-1111-4111-8111-111111111111",
  status:"PARTIALLY_PAID", currency:"USD",
  quoteStatus:"ACCEPTED", quoteCurrency:"USD",
  totalMinor:24000, allocatedMinor:10000, refundedMinor:1000,
  balanceMinor:15000,
};

describe("R35 L23 verified manual reminder scope and clipboard reliability",()=>{
  it("remounts copied draft on every financial, quote or settlement change",()=>{
    const original=staffInvoiceReminderScopeKey(input);
    expect(staffInvoiceReminderScopeKey({...input})).toBe(original);
    for(const changed of [
      {status:"PAID"}, {currency:"EUR"}, {quoteStatus:"REJECTED"},
      {quoteCurrency:"EUR"}, {totalMinor:24001}, {allocatedMinor:10001},
      {refundedMinor:1001}, {balanceMinor:15001},
      {id:"22222222-2222-4222-8222-222222222222"},
    ]) expect(staffInvoiceReminderScopeKey({...input,...changed}))
      .not.toBe(original);
  });
  it("revalidates source ledger and quote before each clipboard draft",()=>{
    expect(verifiedStaffInvoiceReminder(input,"https://example.test")).toContain(
      "Current saved outstanding balance: $150.00");
    expect(verifiedStaffInvoiceReminder({...input,balanceMinor:15001},
      "https://example.test")).toBeNull();
    expect(verifiedStaffInvoiceReminder({...input,quoteStatus:"EXPIRED"},
      "https://example.test")).toBeNull();
  });
  it("keeps copy request operator-only, blocks duplicate pending requests and never sends",()=>{
    const src=readFileSync(join(process.cwd(),
      "src/features/operations/StaffInvoiceManualReminder.tsx"),"utf8");
    expect(src).toContain("key={staffInvoiceReminderScopeKey(invoice)}");
    expect(src).toContain("if (pending.current) return");
    expect(src).toContain("mounted.current");
    expect(src).toContain("disabled={copying}");
    expect(src).toContain("aria-busy={copying}");
    expect(src).toContain("recheck the saved invoice immediately before using any copied text");
    expect(src).toContain("navigator.clipboard.writeText(text)");
    expect(src).toContain("no delivery receipt exists");
    expect(src).not.toContain("fetch(");
    expect(src).not.toContain("sendInvoice(");
  });
});
