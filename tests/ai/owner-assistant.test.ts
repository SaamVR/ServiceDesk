import { describe, expect, test } from "vitest";
import { explainOwnerMetric } from "../../src/server/ai/owner-assistant";

const snapshot = {
  workspaceId: "ws-clearnest",
  from: "2026-10-01T00:00:00.000Z",
  to: "2026-10-04T23:59:59.000Z",
  source: "CORE_METRICS" as const,
  metrics: {
    OPEN_REQUESTS: 12,
    OVERDUE_INVOICES_MINOR: 42500,
  },
};

describe("read-only owner assistant", () => {
  test("explains an actual scoped metric with source and time range", () => {
    const result = explainOwnerMetric(
      { workspaceId: "ws-clearnest", userId: "owner-1", role: "OWNER" },
      snapshot,
      "OPEN_REQUESTS",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        workspaceId: "ws-clearnest",
        metric: "OPEN_REQUESTS",
        value: 12,
        source: "CORE_METRICS",
        timeRange: { from: snapshot.from, to: snapshot.to },
        readOnly: true,
      });
    }
  });

  test("rejects cross-workspace metric access", () => {
    const result = explainOwnerMetric(
      { workspaceId: "ws-other", userId: "owner-2", role: "OWNER" },
      snapshot,
      "OPEN_REQUESTS",
    );

    expect(result).toMatchObject({ ok: false, code: "WORKSPACE_MISMATCH" });
  });

  test("rejects invented metric names", () => {
    const result = explainOwnerMetric(
      { workspaceId: "ws-clearnest", userId: "owner-1", role: "OWNER" },
      snapshot,
      "EXPECTED_REVENUE_NEXT_MONTH",
    );

    expect(result).toMatchObject({ ok: false, code: "UNKNOWN_METRIC" });
  });

  test("does not invent a known metric that is absent from the source snapshot", () => {
    const result = explainOwnerMetric(
      { workspaceId: "ws-clearnest", userId: "owner-1", role: "OWNER" },
      snapshot,
      "BOOKED_SERVICE_MINUTES",
    );

    expect(result).toMatchObject({ ok: false, code: "METRIC_NOT_AVAILABLE" });
  });

  test("rejects non-owner access", () => {
    const result = explainOwnerMetric(
      { workspaceId: "ws-clearnest", userId: "dispatcher-1", role: "DISPATCHER" },
      snapshot,
      "OPEN_REQUESTS",
    );

    expect(result).toMatchObject({ ok: false, code: "OWNER_ROLE_REQUIRED" });
  });
});
