import {describe,expect,it} from "vitest";
import {resolveF19QuoteRecoveryTarget} from "../../src/features/operations/f19-quote-recovery-targets";
import type {OperationalQuote,OperationalRequest} from "../../src/features/operations/operational-product-runtime";
import {readFileSync} from "node:fs";
const quote:OperationalQuote={id:"quote-old",requestId:"req-123",version:1,status:"APPROVED",
 currency:"USD",totalMinor:10000,depositMinor:2000,balanceMinor:8000,
 durationMinutes:60,bufferMinutes:10,subtotalMinor:10000,taxMinor:0,lineItems:null,
 validUntil:"2026-11-30T00:00:00Z"};
const req:OperationalRequest={id:"req-123",customerId:"customer-1",serviceLabel:"Cleaning",
 status:"QUOTING",version:1};
const at="2026-10-30T00:00:00Z";
describe("F19 quote renewal and approval recovery deep-links",()=>{
 it("offers exact current saved version and originating request, never an auto renewal",()=>{
  const got=resolveF19QuoteRecoveryTarget({
   slug:"test-workspace",selectedId:"quote-old",
   quotes:[quote,{...quote,id:"quote-new",version:2}],requests:[req],loadedAt:at
  });
  expect(got).toMatchObject({currentVersionVerified:true,
   sourceRequestHref:"/app/test-workspace/requests?request=req-123",
   currentQuoteHref:"/app/test-workspace/quotes?quote=quote-new",
   automaticSend:false,automaticRenewal:false});
  expect(got?.guidance.reason).toBe("HISTORICAL_VERSION");
 });
 it("no falsely current version when highest versions conflict",()=>{
  const got=resolveF19QuoteRecoveryTarget({slug:"test-workspace",selectedId:"quote-old",
   quotes:[quote,{...quote,id:"quote-new",version:2},{...quote,id:"quote-duplicate",version:2}],
   requests:[req],loadedAt:at});
  expect(got?.guidance.reason).toBe("AMBIGUOUS_CURRENT_VERSION");
  expect(got?.currentVersionVerified).toBe(false);
  expect(got?.currentQuoteHref).toBeUndefined();
 });
 it("fails closed for foreign/missing request, unsafe slugs and duplicate IDs",()=>{
  expect(resolveF19QuoteRecoveryTarget({slug:"test-workspace",selectedId:"quote-old",
   quotes:[quote],requests:[],loadedAt:at})).toBeNull();
  expect(resolveF19QuoteRecoveryTarget({slug:"bad/path",selectedId:"quote-old",
   quotes:[quote],requests:[req],loadedAt:at})).toBeNull();
  expect(resolveF19QuoteRecoveryTarget({slug:"test-workspace",selectedId:"quote-old",
   quotes:[quote,quote],requests:[req],loadedAt:at})).toBeNull();
 });
 it("UI links to exact source records, forbids send & existing quote mutation",()=>{
  const x=readFileSync("src/features/operations/QuoteRecoveryReadinessPanel.tsx","utf8");
  expect(x).toContain("resolveF19QuoteRecoveryTarget");
  expect(x).toContain("sourceRequestHref");
  expect(x).toContain("currentQuoteHref");
  expect(x).toContain('scope.mode==="ALL"||req.branchId===scope.selectedBranchId');
  expect(x).not.toContain("sendOperationalQuote(");
 });
});
