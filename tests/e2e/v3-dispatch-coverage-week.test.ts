import { describe, expect, it } from "vitest";
import { buildDispatchCoverageWeek, normalizeCoverageDay, scheduleCoverageHref } from "@/features/operations/dispatch-coverage-week";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("7-day dispatch workload in business-local dates", () => {
  it("groups visits across DST, excluding cancelled and invalid visits", () => {
    const visits = [
      { startAt: "2026-11-01T05:30:00Z", status: "ASSIGNED", crewId: "crewA" },
      { startAt: "2026-11-01T06:30:00Z", status: "IN_PROGRESS", crewId: "crewB" },
      { startAt: "2026-11-02T01:00:00Z", status: "CONFIRMED" },
      { startAt: "2026-11-01T07:30:00Z", status: "CANCELLED" },
      { startAt: "invalid", status: "CONFIRMED" },
    ];
    const days = buildDispatchCoverageWeek(visits, "2026-11-01T04:01:00Z", "America/New_York");
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ key: "2026-11-01", total: 3, unassigned: 1, underway: 1 });
    expect(days[1].total).toBe(0);
    expect(normalizeCoverageDay("2026-11-01", days)).toBe("2026-11-01");
    expect(normalizeCoverageDay("2026-12-01", days)).toBeUndefined();
  });
  it("retains crew filter and uses only canonical yyyy-mm-dd query values", () => {
    expect(scheduleCoverageHref("unassigned", "2026-11-02")).toBe("?queue=unassigned&day=2026-11-02");
    expect(scheduleCoverageHref("bad", "javascript:alert(1)")).toBe("?");
    expect(scheduleCoverageHref("unassigned")).toBe("?queue=unassigned");
  });
  it("wires the seven-day selection into the authenticated schedule view", () => {
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const page = readFileSync(join(process.cwd(), "src/app/app/[workspace]/schedule/page.tsx"), "utf8");
    expect(route).toContain("<DispatchCoverageWeek");
    expect(route).toContain("normalizeCoverageDay(selectedScheduleDay, coverageDays)");
    expect(route).toContain("scheduleCoverageHref(");
    expect(page).toContain("selectedScheduleDay={query.day}");
  });
});
