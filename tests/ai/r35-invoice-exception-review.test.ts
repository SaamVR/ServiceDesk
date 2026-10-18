import {describe,expect,it} from "vitest";
import {planOwnerInvoiceExceptions} from "../../src/server/ai/invoice-exception-review";
import type {InvoiceDTO} from "../../src/contracts";
const workspaceId="workspace-a",actor={workspaceId,role:"OWNER" as const};
const inv=(id:string,overrides:Partial<InvoiceDTO>={}):InvoiceDTO=>({
 id,workspaceId,status:"ISSUED",currency:"USD",totalMinor:10000,
 allocatedMinor:2000,refundedMinor:0,balanceMinor:8000,...overrides,
});
describe("SONIC L16 invoice finance agent from authoritative ledger facts",()=>{
  it("produces prioritized exceptions and no false payment or refund receipts",()=>{
    const result=planOwnerInvoiceExceptions({workspaceId,actor,invoices:[
      inv("inv-collect"),inv("inv-corrupt",{totalMinor:999}),inv("inv-paid",{
        status:"PAID",totalMinor:100,allocatedMinor:100,balanceMinor:0,
      }),
      inv("inv-void",{status:"VOID"}),
    ]});
    expect(result).toMatchObject({ok:true,value:{
      state:"FINANCE_OWNER_MANUAL_REVIEW",inspectedCount:4,exceptionCount:3,
      exceptions:[
        {invoiceId:"inv-corrupt",priority:"HIGH",codes:["LEDGER_TOTALS_RECONCILIATION"]},
        {invoiceId:"inv-collect",codes:["ISSUED_BALANCE_REVIEW"]},
        {invoiceId:"inv-void",codes:["VOID_REMAINDER_REVIEW"]},
      ],
      paymentConfirmed:false,refundAuthorized:false,providerMessageQueued:false,
    }});
    expect(JSON.stringify(result)).not.toContain("10000");
  });
  it("does not call unpaid balance overdue or claim money collected",()=>{
    const a=planOwnerInvoiceExceptions({workspaceId,actor,invoices:[
      inv("partial",{status:"PARTIALLY_PAID"}),
      inv("draft",{status:"DRAFT"}),
    ]});
    expect(a).toMatchObject({ok:true,value:{exceptionCount:1,
      exceptions:[{invoiceId:"partial",codes:["PARTIAL_BALANCE_REVIEW"]}]}});
    expect(JSON.stringify(a)).not.toMatch(/overdue|customer|paid_by_provider|refund_sent/i);
  });
  it("rejects unauthorized, cross workspace and duplicate invoice identities",()=>{
    expect(planOwnerInvoiceExceptions({workspaceId,actor:{...actor,role:"DISPATCHER"},
      invoices:[inv("x")]})).toMatchObject({ok:false,code:"FINANCE_SCOPE_INVALID"});
    expect(planOwnerInvoiceExceptions({workspaceId,actor,invoices:[inv("a"),inv("a")]}))
      .toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
    expect(planOwnerInvoiceExceptions({workspaceId,actor,invoices:[inv("a",{workspaceId:"other"})]}))
      .toMatchObject({ok:false,code:"FINANCE_SOURCE_INVALID"});
  });
  it("flags malformed ledger values rather than attempting a payment or numeric coercion",()=>{
    for(const totalMinor of [-2,NaN,Infinity,2.5,Number.MAX_SAFE_INTEGER+1,"100"]){
      const r=planOwnerInvoiceExceptions({workspaceId,actor,invoices:[
        inv("invoice-corrupt",{totalMinor:totalMinor as number}),
      ]});
      expect(r).toMatchObject({ok:true,value:{exceptions:[
        {invoiceId:"invoice-corrupt",codes:["LEDGER_TOTALS_RECONCILIATION"]}
      ]}});
    }
  });
});
