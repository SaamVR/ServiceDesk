import { describe, expect, it } from "vitest";
import type { ReportingSnapshotDTO } from "../../src/contracts";
import { buildReportingView } from "../../src/features/reports/view-models";

const snapshot: ReportingSnapshotDTO = {
  workspaceId: "ws_showcase",
  requestCount: 2,
  bookedRequestCount: 1,
  conversionRateBps: 5000,
  collectedMinor: 8500,
  outstandingMinor: 25500,
  currency: "USD",
  scheduledServiceMinutes: 240,
  scheduledBufferMinutes: 30,
  openAttentionCount: 4,
  unresolvedQualityCount: 1,
  generatedAt: "2026-10-04T06:30:00.000Z",
};

describe("reporting view model", () => {
  it("renders authoritative reporting aggregates without recomputing local product records", () => {
    const view = buildReportingView(snapshot);
    expect(view.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Conversion", value: "50.0%", evidence: "1 booked / 2 requests" }),
      expect.objectContaining({ label: "Collected", value: "$85", evidence: "$255 outstanding" }),
      expect.objectContaining({ label: "Scheduled service", value: "4h" }),
      expect.objectContaining({ label: "Scheduled buffer", value: "0h 30m" }),
      expect.objectContaining({ label: "Open attention", value: "4" }),
      expect.objectContaining({ label: "Unresolved quality", value: "1" }),
    ]));
    expect(view.sourceLabel).toBe("SERVER_SNAPSHOT");
  });

  it("preserves no-data conversion when the authoritative snapshot has no conversion denominator", () => {
    const view = buildReportingView({ ...snapshot, requestCount: 0, bookedRequestCount: 0, conversionRateBps: undefined });
    expect(view.cards.find((card) => card.label === "Conversion")?.value).toBe("No data");
  });

  it("preserves fixture labeling when a fixture snapshot is explicitly supplied", () => {
    const view = buildReportingView(snapshot, "FIXTURE_UI_ONLY");
    expect(view.sourceLabel).toBe("FIXTURE_UI_ONLY");
    expect(view.evidenceLabel).toContain("authoritative reporting snapshot");
  });
});
