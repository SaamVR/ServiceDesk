import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  indexAmbiguousCurrentQuoteRequests,
  indexCurrentQuoteByRequest,
} from "../../src/features/operations/staff-snapshot-index";
import { buildQuotePipeline, isCurrentApprovedQuote } from "../../src/features/operations/quote-pipeline";

const now="2026-10-17T00:00:00Z";
const first={id:"offer-A",requestId:"request-collision",version:2,status:"APPROVED",validUntil:"2026-10-20T12:00:00Z"};
const second={id:"offer-B",requestId:"request-collision",version:2,status:"SENT",validUntil:"2026-10-20T12:00:00Z"};
const healthy={id:"offer-C",requestId:"different-request",version:4,status:"APPROVED",validUntil:"2026-10-20T12:00:00Z"};

describe("R12 saved quote version conflict safety and human triage",()=>{
  it("never chooses an arbitrary current offer based on SQL array order",()=>{
    for(const rows of [[first,second,healthy],[second,first,healthy]]) {
      const current=indexCurrentQuoteByRequest(rows);
      expect(current.has("request-collision")).toBe(false);
      expect(current.get("different-request")?.id).toBe("offer-C");
      const queue=buildQuotePipeline(rows,now);
      expect(queue.quoteVersionConflicts).toBe(1);
      expect(queue.readyToSend).toBe(1);
      expect(queue.awaitingCustomer).toBe(0);
      expect(queue.approvedNeedsExpiryReview).toBe(0);
      expect(queue.sentNeedsExpiryReview).toBe(0);
      expect(isCurrentApprovedQuote(first,current)).toBe(false);
      expect(indexAmbiguousCurrentQuoteRequests(rows).has("request-collision")).toBe(true);
    }
  });
  it("restores authority only when a newer unambiguous version exists",()=>{
    const newer={...first,id:"offer-D",version:3};
    const rows=[first,second,newer,healthy];
    const queue=buildQuotePipeline(rows,now);
    expect(queue.quoteVersionConflicts).toBe(0);
    expect(queue.currentQuoteByRequest.get("request-collision")?.id).toBe("offer-D");
    expect(queue.readyToSend).toBe(2);
    expect(isCurrentApprovedQuote(newer,queue.currentQuoteByRequest)).toBe(true);
  });
  it("does not mistake superseded history for an active version collision",()=>{
    const historical={...second,status:"SUPERSEDED"};
    const queue=buildQuotePipeline([first,historical,healthy],now);
    expect(queue.quoteVersionConflicts).toBe(0);
    expect(queue.readyToSend).toBe(2);
  });
  it("shows operators a bounded manual reconciliation task and disables send",()=>{
    const quotes=readFileSync(join(process.cwd(),
      "src/features/operations/OperationalProductRoute.tsx"),"utf8");
    const today=readFileSync(join(process.cwd(),
      "src/features/operations/StaffOverviewDashboard.tsx"),"utf8");
    const view=quotes.slice(quotes.indexOf("function QuotesView("),quotes.indexOf("function ScheduleView("));
    expect(view).toContain("quoteVersionConflicts");
    expect(view).toContain("Multiple current quotes share the highest saved version");
    expect(view).toContain("selectedQuoteCanSend = isCurrentApprovedQuote");
    expect(today).toContain("quoteVersionConflicts");
    expect(today).toContain("quote version conflicts");
    expect(today).toContain("version conflicts</small>");
  });
});
