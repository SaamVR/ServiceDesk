import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {guideSavedQuoteRecovery} from "../../src/features/operations/f17-quote-recovery-guide";
const baseline={id:"q1",requestId:"r1",version:2,status:"APPROVED",currency:"USD",
 totalMinor:10000,depositMinor:2000,balanceMinor:8000,subtotalMinor:10000,
 taxMinor:0,durationMinutes:60,bufferMinutes:0,lineItems:null,validUntil:"2026-11-02T00:00:00Z"};
describe("F17 quote-specific recovery from saved version + preflight",()=>{
 it("never treats conflicting highest version as current or sendable",()=>{
  const q=guideSavedQuoteRecovery([baseline,{...baseline,id:"q2"}],"q1","2026-10-30T00:00:00Z");
  expect(q).toMatchObject({reason:"AMBIGUOUS_CURRENT_VERSION",canSendAutomatically:false});
 });
 it("rejects stale and malformed source instead of inventing a quote",()=>{
  expect(guideSavedQuoteRecovery([baseline],"q1","invalid")).toMatchObject({reason:"SOURCE_UNVERIFIED"});
  expect(guideSavedQuoteRecovery([{...baseline,id:"q-old",version:1},baseline],"q-old","2026-10-30T00:00:00Z"))
   .toMatchObject({reason:"HISTORICAL_VERSION",action:"OPEN_CURRENT_QUOTE"});
 });
 it("rejects unverified saved money and expiry, with no external send",()=>{
  expect(guideSavedQuoteRecovery([baseline],"q1","2026-10-30T00:00:00Z"))
   .toMatchObject({reason:"SAVED_CHARGES_UNVERIFIED",action:"REVIEW_REQUEST_AND_PRICING",customerMessaged:false});
  expect(guideSavedQuoteRecovery([{...baseline,validUntil:"2026-10-01T00:00:00Z"}],"q1","2026-10-30T00:00:00Z"))
   .toMatchObject({reason:"SAVED_CHARGES_UNVERIFIED",canIssueQuoteAutomatically:false});
 });
 it("reuses authoritative saved owner/dispatcher source, no write or send",()=>{
  const p=readFileSync("src/features/operations/QuoteRecoveryReadinessPanel.tsx","utf8");
  expect(p).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
  expect(p).toContain('["OWNER","DISPATCHER"]');
  expect(p).toContain("guideSavedQuoteRecovery(quotes,selected.id,snapshot.loadedAt)");
  expect(p).not.toContain("sendOperationalQuote(");
 });
});
