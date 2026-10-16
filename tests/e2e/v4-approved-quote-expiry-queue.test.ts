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
  for(const invalidClock of ["not-an-instant", "", "  "]) {
    const summary=buildQuotePipeline(quotes,invalidClock);
    expect(summary.readyToSend, invalidClock).toBe(0);
    expect(summary.awaitingCustomer, invalidClock).toBe(0);
    expect(summary.approvedNeedsExpiryReview).toBe(0);
    expect(summary.sentNeedsExpiryReview).toBe(0);
    expect(summary.quoteClockUnverified).toBe(true);
  }
 });
 it("keeps Today's staff waiting pipeline aligned with both expired quote statuses",()=>{
  const summary=buildQuotePipeline(quotes,now);
  expect(summary.sentNeedsExpiryReview).toBe(1);
  expect(summary.approvedNeedsExpiryReview).toBe(2);
  const totalValidityReview=summary.sentNeedsExpiryReview+summary.approvedNeedsExpiryReview;
  expect(totalValidityReview).toBe(3);
  const today=readFileSync(join(process.cwd(),
    "src/features/operations/StaffOverviewDashboard.tsx"),"utf8");
  // The headline and detailed text must both include approved and sent
  // invalidity; previous Today showed fewer tasks than the Quotes workspace.
  expect(today).toContain("const approvedNeedsExpiryReview = quoteQueue.approvedNeedsExpiryReview");
  expect(today).toContain("waitingRequests.length + waitingQuoteCount + sentNeedsExpiryReview + approvedNeedsExpiryReview");
  expect(today).toContain("sentNeedsExpiryReview + approvedNeedsExpiryReview");
  expect(today).toContain("need quote validity review");
 });
 it("gives expired approved offers an actual quote-review route from Today's customer pipeline",()=>{
  const summary=buildQuotePipeline([...quotes,{
    id:"sent-current",requestId:"six",version:1,status:"SENT",
    validUntil:"2026-10-20T12:00:00Z",
  }],now);
  expect(summary.awaitingCustomer).toBe(1);
  expect(summary.sentNeedsExpiryReview+summary.approvedNeedsExpiryReview).toBe(3);
  const today=readFileSync(join(process.cwd(),
    "src/features/operations/StaffOverviewDashboard.tsx"),"utf8");
  expect(today).toContain('<span>Quotes needing follow-up</span>');
  expect(today).toContain('<strong>{waitingQuoteCount + sentNeedsExpiryReview + approvedNeedsExpiryReview}</strong>');
  expect(today).toContain('{waitingQuoteCount} awaiting customer · {sentNeedsExpiryReview + approvedNeedsExpiryReview} need validity review');
  expect(today).toContain('href={buildStaffModuleHref(workspace, "quotes")} className={styles.pipelineItem}');
  expect(today).not.toContain('<span>Quotes with customer</span>');
 });
 it("wire quote workspace aggregate counters to the same expiry-aware snapshot",()=>{
  const src=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  const view=src.slice(src.indexOf("function QuotesView("),src.indexOf("function ScheduleView("));
  expect(view).toContain("buildQuotePipeline(data.quotes, data.loadedAt)");
  expect(view).toContain("sentNeedsExpiryReview + approvedNeedsExpiryReview");
  expect(view).toContain("selectedQuoteCanSend");
  expect(view).toContain("quoteClockUnverified");
  expect(view).toContain("quote snapshot time is unverified");
 });
});
