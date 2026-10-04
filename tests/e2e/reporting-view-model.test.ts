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

  it("bounds conversion by supplied requests and ignores orphan visit request IDs", () => {
    const view = buildReportingView({
      requests: [{ ...sampleRequest, id: "req_supplied", status: "NEW" }],
      quotes: [],
      visits: [
        { ...sampleVisit, id: "visit_orphan_1", requestId: "missing_req_1" },
        { ...sampleVisit, id: "visit_orphan_2", requestId: "missing_req_2" },
      ],
      invoices: [],
    });

    expect(view.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Conversion", value: "0%", evidence: "0 booked / 1 requests" }),
      expect.objectContaining({ label: "Scheduled capacity", value: "9h", evidence: "480m service + 60m buffer" }),
    ]));
  });

  it("deduplicates visits for the same supplied request before conversion", () => {
    const view = buildReportingView({
      requests: [{ ...sampleRequest, id: "req_bookable", status: "NEW" }],
      quotes: [],
      visits: [
        { ...sampleVisit, id: "visit_duplicate_1", requestId: "req_bookable" },
        { ...sampleVisit, id: "visit_duplicate_2", requestId: "req_bookable" },
      ],
      invoices: [],
    });

    expect(view.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Conversion", value: "100%", evidence: "1 booked / 1 requests" }),
      expect.objectContaining({ label: "Scheduled capacity", value: "9h", evidence: "480m service + 60m buffer" }),
    ]));
  });

  it("keeps conversion at no data when no requests are supplied even if visits exist", () => {
    const view = buildReportingView({
      requests: [],
      quotes: [],
      visits: [{ ...sampleVisit, id: "visit_no_request", requestId: "missing_req" }],
      invoices: [],
    });

    expect(view.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Conversion", value: "No data", evidence: "No request records supplied" }),
      expect.objectContaining({ label: "Scheduled capacity", value: "4h 30m", evidence: "240m service + 30m buffer" }),
    ]));
    expect(view.warning).toContain("stored records");
  });

  it("labels no-data reports instead of inventing metrics", () => {
    const view = buildReportingView({ requests: [], quotes: [], visits: [], invoices: [] });

    expect(view.cards.map((card) => card.value)).toContain("No data");
    expect(view.warning).toContain("stored records");
  });
});
