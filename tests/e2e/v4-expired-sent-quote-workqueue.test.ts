import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildQuotePipeline, needsSentQuoteExpiryReview } from "../../src/features/operations/quote-pipeline";

const now = "2026-10-16T12:00:00.000Z";
const quote = (id: string, status: string, validUntil: string, version = 1) => ({
  id, requestId: id.slice(0, 4), status, validUntil, version,
});
describe("stored quote queue validity, no fake waiting customer", () => {
  it("separates sent expired and unknown deadlines from genuinely pending customer", () => {
    const rows = [
      quote("1111-a", "SENT", "2026-10-17T12:00:00.000Z"),
      quote("2222-b", "SENT", "2026-10-15T12:00:00.000Z"),
      quote("3333-c", "SENT", "not-a-date"),
      quote("4444-d", "APPROVED", "2026-10-15T12:00:00.000Z"),
    ];
    const q = buildQuotePipeline(rows, now);
    expect(q.awaitingCustomer).toBe(1);
    expect(q.sentNeedsExpiryReview).toBe(2);
    expect(q.readyToSend).toBe(1);
  });
  it("only counts current quote version and includes equality at expiry", () => {
    const rows = [
      quote("req1-old", "SENT", "2026-10-15T12:00:00.000Z", 1),
      quote("req1-new", "SENT", "2026-10-18T12:00:00.000Z", 2),
      quote("req2-new", "SENT", now, 1),
    ].map(row => ({ ...row, requestId: row.id.slice(0,4) }));
    const q = buildQuotePipeline(rows, now);
    expect(q.awaitingCustomer).toBe(1);
    expect(q.sentNeedsExpiryReview).toBe(1);
    expect(needsSentQuoteExpiryReview(rows[2],now)).toBe(true);
  });
  it("does not mutate customer status or claim an expiry when snapshot clock is invalid", () => {
    const row=quote("req3-old","SENT","invalid");
    expect(needsSentQuoteExpiryReview(row,"invalid")).toBe(false);
    expect(row.status).toBe("SENT");
    expect(buildQuotePipeline([row]).awaitingCustomer).toBe(1);
  });
  it("dashboard labels elapsed quotes as needing staff review", () => {
    const s=readFileSync(join(process.cwd(),"src/features/operations/StaffOverviewDashboard.tsx"),"utf8");
    expect(s).toContain("buildQuotePipeline(snapshot.quotes, snapshot.loadedAt)");
    expect(s).toContain("sentNeedsExpiryReview");
    expect(s).toContain("need quote validity review");
  });
});
