import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildQuotePipeline, needsApprovedQuoteExpiryReview } from "../../src/features/operations/quote-pipeline";

const now = "2026-10-16T12:00:00Z";
const quotes = [
  {id:"approved-future",requestId:"one",version:1,status:"APPROVED",validUntil:"2026-10-16T12:00:01Z"},
  {id:"approved-expired",requestId:"two",version:1,status:"APPROVED",validUntil:"2026-10-15T12:00:00Z"},
  {id:"approved-unknown",requestId:"three",version:1,status:"APPROVED"},
  {id:"sent-expired",requestId:"four",version:1,status:"SENT",validUntil:"2026-10-16T11:59:59Z"},
  {id:"accepted-historical",requestId:"five",version:1,status:"ACCEPTED",validUntil:"2026-10-15T12:00:00Z"},
];

describe("V4 approved quote pipeline enforces live expiry for staff readiness",()=>{
 it("reports only an unexpired APPROVED offer as ready for customer send",()=>{
  const summary=buildQuotePipeline(quotes,now);
  expect(summary.readyToSend).toBe(1);
  expect(summary.approvedNeedsExpiryReview).toBe(2);
  expect(summary.sentNeedsExpiryReview).toBe(1);
  expect(summary.awaitingCustomer).toBe(0);
 });
 it("rejects absent, malformed, past and equal expiry timestamps",()=>{
  for(const validUntil of [undefined,"", "invalid", "2026-10-16T11:59:59Z", now]) {
   expect(needsApprovedQuoteExpiryReview({id:"test",requestId:"r",version:1,status:"APPROVED",validUntil},now)).toBe(true);
  }
  expect(needsApprovedQuoteExpiryReview(quotes[0],now)).toBe(false);
  expect(needsApprovedQuoteExpiryReview(quotes[4],now)).toBe(false);
 });
 it("never presents ready or customer-waiting quotes on a corrupt snapshot clock",()=>{
  const summary=buildQuotePipeline(quotes,"not-an-instant");
  expect(summary.readyToSend).toBe(0);
  expect(summary.awaitingCustomer).toBe(0);
  expect(summary.approvedNeedsExpiryReview).toBe(3);
  expect(summary.sentNeedsExpiryReview).toBe(1);
 });
 it("wire quote workspace aggregate counters to the same expiry-aware snapshot",()=>{
  const src=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  const view=src.slice(src.indexOf("function QuotesView("),src.indexOf("function ScheduleView("));
  expect(view).toContain("buildQuotePipeline(data.quotes, data.loadedAt)");
  expect(view).toContain("sentNeedsExpiryReview + approvedNeedsExpiryReview");
  expect(view).toContain("selectedQuoteCanSend");
 });
});
