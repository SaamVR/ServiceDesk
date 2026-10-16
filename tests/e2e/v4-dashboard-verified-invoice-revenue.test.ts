import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {summarizeVerifiedOutstandingInvoices} from "../../src/features/operations/product-truth";

const invoice={ status:"PARTIALLY_PAID", currency:"USD", totalMinor:24000,
  allocatedMinor:9000, refundedMinor:2000, balanceMinor:17000 };
describe("Today revenue truth from current allocated/refunded invoice ledger",()=>{
  it("only counts collectible reconciled invoice amounts",()=>{
    expect(summarizeVerifiedOutstandingInvoices([invoice])).toMatchObject({
      count:1,totalMinor:17000,currency:"USD",needsLedgerReview:0,
    });
    expect(summarizeVerifiedOutstandingInvoices([
      invoice,{...invoice,allocatedMinor:9999},
      {...invoice,status:"VOID"},
    ])).toMatchObject({count:1,totalMinor:17000,needsLedgerReview:1});
  });
  it("never includes corrupted or forged finance amounts as revenue",()=>{
    const r=summarizeVerifiedOutstandingInvoices([
      {...invoice,balanceMinor:17001},
      {...invoice,refundedMinor:-1},
      {...invoice,totalMinor:"24000"},
      {...invoice,status:"PAID"},
    ]);
    expect(r).toMatchObject({count:0,needsLedgerReview:3});
    expect(r.totalMinor).toBeUndefined();
  });
  it("does not combine different currency minor units",()=>{
    const r=summarizeVerifiedOutstandingInvoices([
      invoice,{...invoice,currency:"EUR"},
    ]);
    expect(r).toMatchObject({count:2,multipleCurrencies:true,needsLedgerReview:0});
    expect(r.totalMinor).toBeUndefined();
  });
  it("does not silently overflow a multi-invoice sum",()=>{
    const huge={...invoice,totalMinor:9000000000000000,
      allocatedMinor:0,refundedMinor:0,balanceMinor:9000000000000000};
    const r=summarizeVerifiedOutstandingInvoices([huge,huge]);
    expect(r).toMatchObject({count:0,needsLedgerReview:2});
  });
  it("shows a review indicator and verified-only currency total",()=>{
    const page=readFileSync(join(process.cwd(),
      "src/features/operations/StaffOverviewDashboard.tsx"),"utf8");
    expect(page).toContain("summarizeVerifiedOutstandingInvoices(");
    expect(page).toContain("need ledger review");
    expect(page).toContain('outstanding.needsLedgerReview ? "Review required"');
  });
});
