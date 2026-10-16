import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { buildQuotePipeline,needsSentQuoteExpiryReview } from "../../src/features/operations/quote-pipeline";
describe("staff quote workspace refuses stale SENT handoff",()=>{
  const source=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  const view=source.slice(source.indexOf("function QuotesView("),source.indexOf("function ScheduleView("));
  it("ties the staff quote work queue to the same snapshot clock as Today",()=>{
    expect(view).toContain("buildQuotePipeline(data.quotes, data.loadedAt)");
    expect(view).toContain("sentNeedsExpiryReview");
    expect(view).toContain("need validity review");
  });
  it("routes expired or unverified sent records to manual recalculation, not share",()=>{
    expect(view).toContain("needsSentQuoteExpiryReview(selectedQuote, data.loadedAt)");
    expect(view).toContain('selectedQuote.status === "SENT" && selectedQuoteNeedsExpiryReview ? (');
    expect(view).toContain("Recalculate request quote");
    expect(view).toContain("It must be recalculated before the customer can accept");
    expect(view.indexOf('selectedQuote.status === "SENT" && selectedQuoteNeedsExpiryReview ? ('))
      .toBeLessThan(view.indexOf("<QuoteCustomerHandoff"));
  });
  it("keeps the latest nonexpired SENT quote in the truthful delivery-review lane",()=>{
    const now="2026-10-16T12:00:00Z";
    const quotes=[
      {id:"a",requestId:"request-a",version:1,status:"SENT",validUntil:"2026-10-17T12:00:00Z"},
      {id:"b",requestId:"request-b",version:1,status:"SENT",validUntil:"2026-10-15T12:00:00Z"},
    ];
    expect(needsSentQuoteExpiryReview(quotes[0],now)).toBe(false);
    expect(needsSentQuoteExpiryReview(quotes[1],now)).toBe(true);
    expect(buildQuotePipeline(quotes,now)).toMatchObject({awaitingCustomer:1,sentNeedsExpiryReview:1});
    expect(view).toContain("Delivery verification");
  });
});
