import {describe,expect,it} from "vitest";
import {hasCurrentSavedQuoteExpiry,trustedQuoteInstant} from "../../src/features/operations/quote-validity-clock";
import {assessOperationalQuoteSend} from "../../src/features/operations/quote-send-readiness";
import {verifyCustomerQuoteForAcceptance} from "../../src/features/operations/customer-quote-acceptance";
const now="2026-10-17T10:00:00Z";
const snapshot={lineItems:[{code:"STANDARD",description:"Standard cleaning",amountMinor:10000,durationMinutes:90}]};
const base={status:"APPROVED",valid_until:"2026-10-18T10:00:00Z",currency:"USD",
 subtotal_minor:10000,tax_minor:500,total_minor:10500,deposit_minor:2100,
 balance_minor:8400,duration_minutes:90,snapshot};
describe("R15 staff send/customer accept quote clock authority",()=>{
 it("accepts explicit UTC and offset instants for business decisions",()=>{
  expect(hasCurrentSavedQuoteExpiry(now,base.valid_until)).toBe(true);
  expect(hasCurrentSavedQuoteExpiry(now,"2026-10-18T12:00:00+02:00")).toBe(true);
  expect(assessOperationalQuoteSend(base,now)).toEqual({ok:true});
  expect(verifyCustomerQuoteForAcceptance({...base,status:"SENT"},now)).toEqual({ok:true});
 });
 it("rejects incomplete, timezone-less or expired quote clocks in both roles",()=>{
  for(const invalid of ["2026-10-18T10:00:00","2026-10-18",
    "tomorrow","2026-10-17T10:00:00Z","2026-10-18T10:00:00+99:00",
    "",123,{},null]){
   expect(hasCurrentSavedQuoteExpiry(now,invalid)).toBe(false);
   expect(assessOperationalQuoteSend({...base,valid_until:invalid},now))
     .toEqual({ok:false,reason:"EXPIRED"});
   expect(verifyCustomerQuoteForAcceptance({...base,status:"SENT",valid_until:invalid},now))
     .toEqual({ok:false,code:"QUOTE_EXPIRED"});
  }
  expect(trustedQuoteInstant("2026-10-17T10:00:00")).toBeNull();
  expect(assessOperationalQuoteSend(base,"2026-10-17T10:00:00"))
    .toEqual({ok:false,reason:"EXPIRED"});
 });
});
