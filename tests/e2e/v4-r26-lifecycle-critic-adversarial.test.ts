import { describe, it, expect } from "vitest";
import { summarizeSavedRequestLifecycle } from "../../src/features/operations/saved-request-lifecycle";
import type { OperationalRequest,OperationalQuote,OperationalVisit,OperationalInvoice } from "../../src/features/operations/operational-product-runtime";

const req={id:"00000000-0000-4000-8000-000000000001",version:3,serviceLabel:"Standard cleaning",status:"READY"} as OperationalRequest;
const base={id:"00000000-0000-4000-8000-000000000002",requestId:req.id,version:2,status:"SENT",currency:"USD",
  totalMinor:10000,depositMinor:0,balanceMinor:10000,durationMinutes:60,bufferMinutes:15} as OperationalQuote;
const visit={id:"00000000-0000-4000-8000-000000000003",requestId:req.id,quoteId:base.id,status:"COMPLETED"} as OperationalVisit;
const invoice={id:"00000000-0000-4000-8000-000000000004",quoteId:base.id,status:"PAID"} as OperationalInvoice;
const run=(quotes:OperationalQuote[], visits:OperationalVisit[], invoices:OperationalInvoice[])=>
  summarizeSavedRequestLifecycle({request:req,quotes,visits,invoices});

describe("CRITIC-01 / R26 adversarial real-record semantics",()=>{
  it("never connects a historical paid invoice or visit to an unrelated new approved offer",()=>{
    const latest={...base,id:"00000000-0000-4000-8000-000000000005",version:3,status:"APPROVED"};
    const result=run([base,latest],[visit],[invoice]);
    expect(result.steps[1]).toMatchObject({recordId:latest.id,status:"READY_FOR_STAFF"});
    expect(result.steps[2].recordId).toBeUndefined();
    expect(result.steps[3].recordId).toBeUndefined();
  });
  it("ignores superseded version ties that do not actually create current-version ambiguity",()=>{
    const current={...base,id:"00000000-0000-4000-8000-000000000005",status:"ACCEPTED",version:3};
    const stale={...base,id:"00000000-0000-4000-8000-000000000006",status:"SUPERSEDED",version:3};
    const result=run([base,current,stale],[visit],[invoice]);
    expect(result.steps[1]).toMatchObject({recordId:current.id,status:"ACCEPTED"});
    expect(result.steps[2].recordId).toBeUndefined();
  });
  it("shows database PAID as saved ledger rather than independently settled provider",()=>{
    const result=run([{...base,status:"ACCEPTED"}],[visit],[invoice]);
    expect(result.steps[3]).toMatchObject({recordId:invoice.id,status:"COMPLETED"});
    expect(result.steps[3].detail).toContain("payment-provider settlement needs separate proof");
  });
  it("never marks a SENT quote as customer-accepted, even when a linked job exists",()=>{
    const result=run([base],[visit],[invoice]);
    expect(result.steps[1].status).toBe("AWAITING_CUSTOMER");
    expect(result.steps[1].detail).toContain("customer acceptance");
  });
  it("handles no loaded records as uncertainty, never as proof of nonexistent or delivered stages",()=>{
    const result=run([],[],[]);
    expect(result.steps[1].status).toBe("NOT_OBSERVED");
    expect(result.disclosure).toContain("not proof that no record exists");
    expect(result.disclosure).toContain("separate evidence");
  });
});
