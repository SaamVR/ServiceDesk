import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { isVerifiedPaidInvoiceMilestone } from "../../src/server/workflows/paid-invoice-milestone";

const settled={ status:"PAID", currency:"USD", total_minor:29000,
  allocated_minor:34000, refunded_minor:5000, balance_minor:0 };
describe("owner INVOICE_PAID workflow business-state proof",()=>{
  test("accepts an actual settled amount after refunded allocations",()=>{
    expect(isVerifiedPaidInvoiceMilestone(settled)).toBe(true);
    expect(isVerifiedPaidInvoiceMilestone({...settled,allocated_minor:29000,refunded_minor:0})).toBe(true);
  });
  test("blocks PAID flags with inconsistent ledger values, refund drift, invalid currency",()=>{
    for(const patch of [
      {status:"PARTIALLY_PAID"},{status:"VOID"},{total_minor:0},
      {total_minor:30000},{allocated_minor:29000},{refunded_minor:9000},
      {balance_minor:1000},{currency:"usd"},{currency:""},
      {allocated_minor:Number.NaN},{refunded_minor:-1},{total_minor:0.1},
    ]) expect(isVerifiedPaidInvoiceMilestone({...settled,...patch})).toBe(false);
  });
  test("loads saved invoice financial proof and checks accepted same-currency quote before rule evaluation",()=>{
    const s=readFileSync(join(process.cwd(),"src/server/workflows/owner-operational-automation.ts"),"utf8");
    const invoice=s.indexOf('} else if (eventType === "INVOICE_PAID") {');
    const part=s.slice(invoice,s.indexOf('} else {',invoice));
    expect(part).toContain('total_minor,allocated_minor,refunded_minor,balance_minor');
    expect(part).toContain('isVerifiedPaidInvoiceMilestone(row.data)');
    expect(part).toContain('quote.data.status !== "ACCEPTED"');
    expect(part).toContain('quote.data.currency !== row.data.currency');
    expect(s.indexOf("isVerifiedPaidInvoiceMilestone(row.data)")).toBeLessThan(s.indexOf('from("workflow_rules")'));
  });
});
