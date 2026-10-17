import {describe,expect,it} from "vitest";
import {customerInvoiceSandboxReadiness as check,type CustomerInvoiceCheckoutFacts} from "../../src/features/operations/customer-invoice-checkout-readiness";
const valid:CustomerInvoiceCheckoutFacts={status:"ISSUED",currency:"USD",totalMinor:34000,
 allocatedMinor:8500,refundedMinor:0,balanceMinor:25500,quoteStatus:"ACCEPTED",quoteCurrency:"USD"};
const asFacts=(value:unknown)=>value as CustomerInvoiceCheckoutFacts;
describe("R20C customer invoice preflight cannot be coerced into a payment",()=>{
 it("preserves actual tenant-owned issued and partially paid balances",()=>{
  expect(check(valid)).toEqual({ok:true,amountMinor:25500,currency:"USD"});
  expect(check({...valid,status:"PARTIALLY_PAID",allocatedMinor:15000,refundedMinor:5000,balanceMinor:24000}))
   .toEqual({ok:true,amountMinor:24000,currency:"USD"});
 });
 it("rejects missing or malformed payloads without throwing",()=>{
  for(const v of [null,undefined,false,[],{},23]){
   expect(check(asFacts(v))).toMatchObject({ok:false});
  }
 });
 it("never coerces buyer-supplied money or currency objects",()=>{
  const poison={valueOf(){throw Error("VALUEOF_MUST_NOT_RUN");},toString(){throw Error("TOSTRING_MUST_NOT_RUN");}};
  for(const key of ["totalMinor","allocatedMinor","refundedMinor","balanceMinor"] as const){
   expect(check(asFacts({...valid,[key]:poison})),key).toMatchObject({ok:false,reason:"AMOUNTS_MISMATCH"});
  }
  for(const key of ["currency","quoteCurrency"] as const){
   expect(check(asFacts({...valid,[key]:poison})),key).toMatchObject({ok:false,reason:"CURRENCY_MISMATCH"});
  }
 });
 it("denies unreconciled amounts and already paid invoices",()=>{
  expect(check({...valid,balanceMinor:25501})).toMatchObject({ok:false,reason:"AMOUNTS_MISMATCH"});
  expect(check({...valid,status:"PAID",allocatedMinor:34000,balanceMinor:0})).toMatchObject({ok:false,reason:"NO_BALANCE"});
  expect(check({...valid,quoteStatus:"SENT"})).toMatchObject({ok:false,reason:"QUOTE_NOT_ACCEPTED"});
 });
});
