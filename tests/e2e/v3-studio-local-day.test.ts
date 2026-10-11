import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createLocalDayKey } from "../../src/features/operations/staff-local-day";

describe("Studio OS timezone-correct daily dispatch", () => {
  it("buckets UTC midnight by the actual workspace-local day", () => {
    const newYork = createLocalDayKey("America/New_York");
    const dhaka = createLocalDayKey("Asia/Dhaka");
    expect(newYork("2026-10-11T01:00:00Z")).toBe("2026-10-10");
    expect(dhaka("2026-10-11T01:00:00Z")).toBe("2026-10-11");
  });
  it("observes daylight-saving transition without artificial 24-hour calculations", () => {
    const newYork = createLocalDayKey("America/New_York");
    expect(newYork("2026-03-08T04:30:00Z")).toBe("2026-03-07");
    expect(newYork("2026-03-08T07:30:00Z")).toBe("2026-03-08");
  });
  it("never matches an invalid visit date to an invalid snapshot date", () => {
    const key = createLocalDayKey("UTC");
    expect(key("not-a-date")).toBeUndefined();
    const source = readFileSync(join(process.cwd(),
      "src/features/operations/StaffOverviewDashboard.tsx"), "utf8");
    expect(source).toContain("const todayVisits = todayKey");
    expect(source).toContain("indexStaffById(snapshot.crews)");
    expect(source).toContain("records.requests.get(visit.requestId)");
    expect(source).not.toContain("snapshot.requests.find((item) => item.id === visit.requestId)");
  });
});
