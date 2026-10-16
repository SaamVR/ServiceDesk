import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildQuotePipeline, isCurrentApprovedQuote } from "@/features/operations/quote-pipeline";

const quotes = [
  { id: "old-approved", requestId: "request-1", version: 1, status: "APPROVED" },
  { id: "latest-sent", requestId: "request-1", version: 2, status: "SENT" },
  { id: "superseded", requestId: "request-1", version: 3, status: "SUPERSEDED" },
  { id: "old-draft", requestId: "request-2", version: 1, status: "APPROVED" },
  { id: "latest-draft", requestId: "request-2", version: 2, status: "DRAFT" },
  { id: "current-approved", requestId: "request-3", version: 1, status: "APPROVED" },
];

describe("Studio OS version-safe quoting", () => {
  it("counts only current approved quotes as ready to send", () => {
    const pipeline = buildQuotePipeline(quotes);
    expect(pipeline.readyToSend).toBe(1);
    expect(pipeline.awaitingCustomer).toBe(1);
    expect(pipeline.currentQuoteByRequest.get("request-1")?.id).toBe("latest-sent");
    expect(pipeline.currentQuoteByRequest.get("request-2")?.id).toBe("latest-draft");
    expect(isCurrentApprovedQuote(quotes[0], pipeline.currentQuoteByRequest)).toBe(false);
    expect(isCurrentApprovedQuote(quotes[3], pipeline.currentQuoteByRequest)).toBe(false);
    expect(isCurrentApprovedQuote(quotes[5], pipeline.currentQuoteByRequest)).toBe(true);
    expect(isCurrentApprovedQuote(quotes[2], pipeline.currentQuoteByRequest)).toBe(false);
  });

  it("prioritizes current versions and retains old versions for read-only history", () => {
    const pipeline = buildQuotePipeline(quotes);
    expect(pipeline.orderedQuotes.slice(0, 3).map(q => q.id)).toEqual([
      "current-approved", "latest-sent", "latest-draft",
    ]);
    expect(pipeline.orderedQuotes).toHaveLength(quotes.length);
    expect(pipeline.orderedQuotes.slice(3).map(q => q.id)).toEqual([
      "old-approved", "old-draft", "superseded",
    ]);
    expect(quotes[0]?.id).toBe("old-approved");
  });

  it("makes every operational surface use the same authoritative version index", () => {
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const quotesView = route.slice(route.indexOf("function QuotesView("), route.indexOf("function ScheduleView("));
    const overview = readFileSync(join(process.cwd(), "src/features/operations/StaffOverviewDashboard.tsx"), "utf8");
    const badges = readFileSync(join(process.cwd(), "src/features/operations/operational-journey-counts.ts"), "utf8");
    expect(quotesView).toContain("buildQuotePipeline(data.quotes, data.loadedAt)");
    expect(quotesView).toContain("isCurrentApprovedQuote(selectedQuote, currentQuoteByRequest)");
    expect(quotesView).toContain("Historical version");
    expect(quotesView).toContain("This is not the current quote version");
    expect(quotesView).toContain("selectedQuoteCanSend ? (");
    expect(overview).toContain("buildQuotePipeline(snapshot.quotes, snapshot.loadedAt)");
    expect(badges).toContain("buildQuotePipeline(snapshot.quotes).readyToSend");
  });
});
