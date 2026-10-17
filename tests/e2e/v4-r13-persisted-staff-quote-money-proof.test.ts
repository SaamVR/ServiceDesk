import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSavedStaffQuoteRowVerifiable } from "../../src/features/operations/saved-quote-row-proof";

const quote={
  id:"11111111-1111-4111-8111-111111111111",
  request_id:"22222222-2222-4222-8222-222222222222",
  status:"APPROVED",currency:"USD",version:2,
  subtotal_minor:5000,tax_minor:500,total_minor:5500,
  deposit_minor:1100,balance_minor:4400,duration_minutes:90,buffer_minutes:15,
};
describe("R13 staff persisted quote proof prevents fictional zero-value offers",()=>{
  it("preserves actual zero priced drafts and safe integer approved offers",()=>{
    expect(isSavedStaffQuoteRowVerifiable(quote)).toBe(true);
    expect(isSavedStaffQuoteRowVerifiable({...quote,status:"DRAFT",
      subtotal_minor:0,tax_minor:0,total_minor:0,
      deposit_minor:0,balance_minor:0,duration_minutes:0,buffer_minutes:0})).toBe(true);
    expect(isSavedStaffQuoteRowVerifiable({...quote,status:"SENT"})).toBe(true);
    // PostgreSQL quote_status enum also contains this human-approval state.
    expect(isSavedStaffQuoteRowVerifiable({...quote,status:"PENDING_APPROVAL"})).toBe(true);
  });
  it("refuses missing, mistyped, unsafe and negative persisted money/version data",()=>{
    for(const patch of [
      {id:undefined},{id:""},{id:0},{request_id:null},{request_id:0},
      {status:"PAID"},{status:undefined},{currency:undefined},{currency:"usd"},
      {currency:"USD\n"},{version:undefined},{version:0},{version:"2"},
      {version:1.5},{version:Number.MAX_SAFE_INTEGER+1},
      ...["subtotal_minor","tax_minor","total_minor","deposit_minor",
        "balance_minor","duration_minutes","buffer_minutes"].flatMap(key=>[
          {[key]:undefined},{[key]:null},{[key]:"0"},{[key]:-1},
          {[key]:Number.NaN},{[key]:0.5},{[key]:Number.MAX_SAFE_INTEGER+1},
        ]),
    ]) expect(isSavedStaffQuoteRowVerifiable({...quote,...patch}),JSON.stringify(patch))
      .toBe(false);
  });
  it("rejects typed but contradictory saved price, tax, deposit and balance claims",()=>{
    // Previously each column was individually safe but the staff summary
    // could still show unbalanced APPROVED/SENT quote money as reliable.
    for(const patch of [
      {subtotal_minor:4900},{tax_minor:499},{total_minor:5499},
      {deposit_minor:1099},{balance_minor:4399},
      {subtotal_minor:Number.MAX_SAFE_INTEGER,tax_minor:500},
      {deposit_minor:Number.MAX_SAFE_INTEGER,balance_minor:4400},
    ]) expect(isSavedStaffQuoteRowVerifiable({...quote,...patch}),JSON.stringify(patch))
      .toBe(false);
    expect(isSavedStaffQuoteRowVerifiable({...quote,
      deposit_minor:0,balance_minor:5500})).toBe(true);
    expect(isSavedStaffQuoteRowVerifiable({...quote,
      tax_minor:0,total_minor:5000,deposit_minor:5000,balance_minor:0})).toBe(true);
  });
  it("gates staff snapshot before verified quote can be treated as ready to send",()=>{
    const runtime=readFileSync(join(process.cwd(),
      "src/features/operations/operational-product-runtime.ts"),"utf8");
    expect(runtime).toContain("quoteRows.some(row => !isSavedStaffQuoteRowVerifiable(row))");
    expect(runtime.indexOf("quoteRows.some(row => !isSavedStaffQuoteRowVerifiable(row))"))
      .toBeLessThan(runtime.indexOf("const quotes: OperationalQuote[]"));
    expect(runtime).toContain("Saved quote amounts or identities could not be verified");
    // Existing runtime also computes line item verification; do not weaken it.
    expect(runtime).toContain("readVerifiedCustomerQuoteLineItems(");
  });
});
