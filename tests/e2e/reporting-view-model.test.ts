import { describe, expect, it } from "vitest";
import { buildReportingView } from "../../src/features/reports/view-models";
import { sampleInvoice, sampleQuote, sampleRequest, sampleVisit } from "../../src/features/operations/sample-data";

describe("reporting view model", () => {
  it("derives collection and capacity metrics only from supplied records", () => {
    const view = buildReportingView({
      requests: [sampleRequest, { ...sampleRequest, id: "req_lost", status: "LOST" }],
      quotes: [sampleQuote],
      visits: [sampleVisit],
      invoices: [sampleInvoice],
    });

    expect(view.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Conversion", value: "50%", evidence: "1 booked / 2 requests" }),
      expect.objectContaining({ label: "Collected", value: "$85", evidence: "$255 balance remains" }),
      expect.objectContaining({ label: "Scheduled capacity", value: "4h 30m", evidence: "240m service + 30m buffer" }),
      expect.objectContaining({ label: "Contribution", value: "Missing cost data", evidence: "Direct costs not supplied" }),
    ]));
  });

  it("labels no-data reports instead of inventing metrics", () => {
    const view = buildReportingView({ requests: [], quotes: [], visits: [], invoices: [] });

    expect(view.cards.map((card) => card.value)).toContain("No data");
    expect(view.warning).toContain("stored records");
  });
});
