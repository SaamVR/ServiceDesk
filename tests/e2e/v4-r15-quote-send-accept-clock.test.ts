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
  expect(trustedQuoteInstant("2024-02-29T10:00:00.123456Z")).not.toBeNull();
  expect(trustedQuoteInstant("2026-10-18T12:00:00.123456+02:00")).not.toBeNull();
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
  for(const malformed of [
    "2026-02-30T10:00:00Z", "2025-02-29T10:00:00Z",
    "2026-04-31T10:00:00Z", "2026-10-18T24:00:00Z",
    "2026-10-18T10:60:00Z", "2026-10-18T10:00:60Z",
    "2026-00-01T10:00:00Z", "2026-13-01T10:00:00Z",
  ]) {
    expect(trustedQuoteInstant(malformed), malformed).toBeNull();
    expect(assessOperationalQuoteSend({...base,valid_until:malformed},now))
      .toEqual({ok:false,reason:"EXPIRED"});
    expect(verifyCustomerQuoteForAcceptance({...base,status:"SENT",valid_until:malformed},now))
      .toEqual({ok:false,code:"QUOTE_EXPIRED"});
  }
  // Business quote decisions require a possible explicit timezone offset,
  // including microsecond PostgreSQL timestamp serialization.
  for (const malformedOffset of [
    "2026-10-18T10:00:00+14:01",
    "2026-10-18T10:00:00-14:30",
    "2026-10-18T10:00:00+15:00",
    "2026-10-18T10:00:00-19:00",
    "2026-10-18T10:00:00+00:60",
    "0000-10-18T10:00:00Z",
  ]) {
    expect(trustedQuoteInstant(malformedOffset), malformedOffset).toBeNull();
    expect(assessOperationalQuoteSend({...base,valid_until:malformedOffset},now))
      .toEqual({ok:false,reason:"EXPIRED"});
    expect(verifyCustomerQuoteForAcceptance({...base,status:"SENT",valid_until:malformedOffset},now))
      .toEqual({ok:false,code:"QUOTE_EXPIRED"});
  }
  for (const validOffset of [
    "2026-10-18T10:00:00.123456+14:00",
    "2026-10-18T10:00:00.123456-14:00",
    "2026-10-18T10:00:00.123456+05:45",
  ]) expect(trustedQuoteInstant(validOffset),validOffset).not.toBeNull();
    expect(trustedQuoteInstant("2026-10-17T10:00:00")).toBeNull();
  expect(assessOperationalQuoteSend(base,"2026-10-17T10:00:00"))
    .toEqual({ok:false,reason:"EXPIRED"});
 });
});
