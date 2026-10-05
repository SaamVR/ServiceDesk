import { describe, expect, it } from "vitest";
import {
  buildDispatchStaffSnapshot,
  requiredDispatchStaffReadContract,
} from "../../src/features/dispatch/staff-integration";

describe("V2 dispatch staff snapshot adapter", () => {
  it("builds dispatch input from operational visit/request/quote data without inventing crew eligibility", () => {
    const result = buildDispatchStaffSnapshot({
      workspaceId: "ws_1",
      visits: [{
        id: "visit_1",
        requestId: "req_1",
        quoteId: "quote_1",
        status: "CONFIRMED",
        startAt: "2026-10-05T09:00:00.000Z",
        endAt: "2026-10-05T11:30:00.000Z",
        version: 4,
      }],
      requests: [{ id: "req_1", serviceCode: "MOVE_OUT" }],
      quotes: [{ id: "quote_1", durationMinutes: 120 }],
      crews: [{
        id: "crew_1",
        workspaceId: "ws_1",
        active: true,
        availableFrom: "2026-10-05T08:00:00.000Z",
        availableTo: "2026-10-05T18:00:00.000Z",
        serviceCodes: ["MOVE_OUT"],
      }],
      attentionItems: [{
        id: "attention_1",
        type: "FIELD_INCIDENT",
        severity: "WARNING",
        status: "OPEN",
        resourceType: "visit",
        resourceId: "visit_1",
        summary: "Review access note.",
      }],
    });

    expect(result.dataQualityIssues).toEqual([]);
    expect(result.snapshot.visits[0]).toMatchObject({
      workspaceId: "ws_1",
      serviceCode: "MOVE_OUT",
      serviceMinutes: 120,
      bufferMinutes: 30,
    });
    expect(result.snapshot.crews).toEqual([
      expect.objectContaining({ id: "crew_1", workspaceId: "ws_1", active: true }),
    ]);
    expect(result.snapshot.attentionItems?.[0]?.workspaceId).toBe("ws_1");
  });

  it("omits incomplete schedule records and returns visible data-quality blockers instead of fabricated timing", () => {
    const result = buildDispatchStaffSnapshot({
      workspaceId: "ws_1",
      visits: [
        {
          id: "visit_missing_start",
          requestId: "req_1",
          quoteId: "quote_1",
          status: "CONFIRMED",
          version: 1,
        },
        {
          id: "visit_missing_duration",
          requestId: "req_1",
          quoteId: "quote_missing",
          status: "CONFIRMED",
          startAt: "2026-10-05T09:00:00.000Z",
          version: 2,
        },
      ],
      requests: [{ id: "req_1" }],
      quotes: [],
      crews: [],
    });

    expect(result.snapshot.visits).toEqual([]);
    expect(result.dataQualityIssues.map((item) => item.code)).toEqual([
      "MISSING_START_TIME",
      "MISSING_DURATION",
    ]);
  });

  it("filters candidate crews to the selected workspace before recommendations are built", () => {
    const result = buildDispatchStaffSnapshot({
      workspaceId: "ws_1",
      visits: [],
      requests: [],
      quotes: [],
      crews: [
        { id: "crew_1", workspaceId: "ws_1", active: true },
        { id: "crew_other", workspaceId: "ws_other", active: true },
      ],
    });

    expect(result.snapshot.crews.map((crew) => crew.id)).toEqual(["crew_1"]);
  });

  it("publishes an explicit read contract rather than inferring active crew or routing data", () => {
    expect(requiredDispatchStaffReadContract.required).toContain("active crews in the same workspace");
    expect(requiredDispatchStaffReadContract.rule).toContain("Do not infer");
  });
});
