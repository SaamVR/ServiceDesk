import { describe, expect, test } from "vitest";
import { readVerifiedCustomerQuoteLineItems } from "../../src/features/operations/customer-quote-line-items";
import { verifiedManualQuoteHandoffMessage } from "../../src/features/operations/quote-manual-handoff";

const quote={
  quoteId: "11111111-1111-4111-8111-111111111111",
  status: "SENT",currency:"USD",validUntil:"2030-01-01T00:00:00Z",
  subtotalMinor:25000,taxMinor:0,totalMinor:25000,
  depositMinor:5000,balanceMinor:20000,durationMinutes:90,
  lineItems:[{code:"BASE",description:"Standard clean",amountMinor:25000,durationMinutes:90}],
};
const now=new Date("2026-10-13T09:00:00Z");

describe("saved quote descriptions resist customer-facing text direction spoofing",()=>{
  test("normal Unicode letters remain valid in persisted quoted service descriptions",()=>{
    const detail={...quote.lineItems[0],description:"Café cleaning"};
    expect(readVerifiedCustomerQuoteLineItems({lineItems:[detail]},25000,90,0,25000)).toMatchObject([detail]);
  });
  test("bidi controls and invisible separators cannot enter customer-visible monetary line items",()=>{
    const malicious=[
      "Standard \u202E99.00\u202C clean",
      "\u2066Price 10\u2069",
      "Base\u200B clean",
      "Base\uFEFF clean",
      "Base\u2060clean",
      "Base\u200F clean",
    ];
    for(const description of malicious){
      const lines=[{...quote.lineItems[0],description}];
      expect(readVerifiedCustomerQuoteLineItems({lineItems:lines},25000,90,0,25000),description).toBeNull();
      const attempted=verifiedManualQuoteHandoffMessage({...quote,lineItems:lines},
        "https://servicedesk-v3-frontend-review.onrender.com",now);
      expect(attempted).toBeNull();
    }
  });
});
