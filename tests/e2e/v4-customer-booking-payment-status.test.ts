import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { customerBookingPaymentSummary } from "../../src/features/operations/customer-booking-payment-truth";

const good={status:"PAID",currency:"USD",totalMinor:24000,
  allocatedMinor:26000,refundedMinor:2000,balanceMinor:0};
describe("real customer booking invoice payment truth",()=>{
  test("distinguishes a genuine saved paid ledger from zero-balance drafts/voids",()=>{
    expect(customerBookingPaymentSummary(good)).toMatchObject({title:"Invoice recorded as paid",tone:"success"});
    for(const status of ["DRAFT","VOID"])
      expect(customerBookingPaymentSummary({...good,status}).tone).toBe("info");
  });
  test("refuses a paid badge from broken allocations, refunds or partial states",()=>{
    for(const patch of [
      {status:"PAID",totalMinor:25000},
      {status:"PAID",allocatedMinor:24000},
      {status:"PAID",balanceMinor:1000},
      {status:"PAID",refundedMinor:3000},
    ]) expect(customerBookingPaymentSummary({...good,...patch}).tone).not.toBe("success");
  });
  test("shows a verified issued partial balance as outstanding, not fully paid",()=>{
    const result=customerBookingPaymentSummary({
      ...good,status:"PARTIALLY_PAID",allocatedMinor:9000,refundedMinor:1000,balanceMinor:16000,
    });
    expect(result).toMatchObject({title:"Invoice balance outstanding",tone:"warning"});
    expect(result.detail).toContain("refunds");
  });
  test("booking UI derives messaging from saved ledger summary, not raw zero balance",()=>{
    const code=readFileSync(join(process.cwd(),"src/features/operations/CustomerProductRoute.tsx"),"utf8");
    const i=code.indexOf("function BookingView(");
    const j=code.indexOf("function InvoiceView(",i);
    const view=code.slice(i,j);
    expect(view).toContain("customerBookingPaymentSummary(invoice)");
    expect(view).toContain('title={payment?.title');
    expect(view).not.toContain('"Payment up to date"');
  });
});
