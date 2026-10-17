import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildQuotePipeline } from "../../src/features/operations/quote-pipeline";

describe("R27 real staff action: approved offers appear on Today", () => {
  const current="2026-10-17T11:00:00Z";
  it("counts only current, not-expired approved quotes as staff send-ready", () => {
    const rows=[
      {id:"old",requestId:"one",status:"APPROVED",version:1,validUntil:"2026-10-19T11:00:00Z"},
      {id:"new",requestId:"one",status:"APPROVED",version:2,validUntil:"2026-10-19T11:00:00Z"},
      {id:"expired",requestId:"two",status:"APPROVED",version:1,validUntil:"2026-10-16T11:00:00Z"},
      {id:"sent",requestId:"three",status:"SENT",version:1,validUntil:"2026-10-19T11:00:00Z"},
    ];
    const summary=buildQuotePipeline(rows,current);
    expect(summary.readyToSend).toBe(1);
    expect(summary.approvedNeedsExpiryReview).toBe(1);
    expect(summary.awaitingCustomer).toBe(1);
  });
  it("source actually includes quote send-ready count in both Today and customer pipeline, never provider delivery", () => {
    const src=readFileSync("src/features/operations/StaffOverviewDashboard.tsx","utf8");
    expect(src).toContain("const quotesReadyToSend = quoteQueue.readyToSend;");
    expect(src).toContain("waitingRequests.length + quotesReadyToSend + waitingQuoteCount");
    expect(src).toContain("<strong>{quotesReadyToSend + waitingQuoteCount");
    expect(src).toContain("approved for staff send");
    expect(src).toContain('href={buildStaffModuleHref(workspace, "quotes")} className={styles.pipelineItem}');
    expect(src).not.toContain("approved provider delivery");
  });
  it("no verified clock means no ready-to-send claim",()=>{
    const q=buildQuotePipeline([{id:"a",requestId:"r",status:"APPROVED",version:1,validUntil:"2026-10-18T11:00:00Z"}],"broken");
    expect(q.readyToSend).toBe(0);
  });
});
