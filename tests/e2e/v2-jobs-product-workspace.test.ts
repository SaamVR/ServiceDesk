import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 jobs operational workspace", () => {
  it("persists the selected job in route state", () => {
    const page = source("src/app/app/[workspace]/jobs/page.tsx");
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(page).toContain("job?: string");
    expect(page).toContain("selectedJobId={query.job}");
    expect(route).toContain('data.visits.find((visit) => visit.id === selectedJobId)');
    expect(route).toContain("selectedRowKey={selectedVisit.id}");
  });

  it("shows one selected job detail instead of expanding several editable jobs", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(route).toContain('href={"?job=" + encodeURIComponent(visit.id)}');
    expect(route).toContain('value={selectedVisit.id}');
    expect(route).toContain("selectedEvidence");
    expect(route).toContain("selectedChecklist");
    expect(route).not.toContain(
      '.slice(0, 6)\n        .map((visit) => {\n          const evidence = data.visitEvidence.filter((item) => item.visitId === visit.id)',
    );
  });

  it("returns to the same selected job after staff mutations", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const occurrences = route.match(/"job=" \+ encodeURIComponent\(visitId\) \+ "&"/g) ?? [];

    expect(occurrences).toHaveLength(3);
  });
});
