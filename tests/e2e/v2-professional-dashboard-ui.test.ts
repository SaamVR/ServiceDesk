import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional operations UI", () => {
  it("treats the staff overview as an operational command center", () => {
    const dashboard = source("src/features/operations/StaffOverviewDashboard.tsx");
    expect(dashboard).toContain("Operations command center");
    expect(dashboard).toContain("Today's jobs");
    expect(dashboard).toContain("Needs attention");
    expect(dashboard).toContain("Customer pipeline");
    expect(dashboard).toContain("Quick access");
    expect(dashboard).toContain("customer?.displayName");
    expect(dashboard).toContain("crew?.name");
    expect(dashboard).toContain("attentionResourceHref");
    expect(dashboard).not.toContain("Visit {visit.id}");
  });

  it("uses scannable semantic navigation instead of dot-only staff navigation", () => {
    const shell = source("src/components/product/StaffAppShell.tsx");
    expect(shell).toContain("function NavIcon");
    expect(shell).toContain("app-nav-icon");
    expect(shell).not.toContain("app-nav-indicator");
  });

  it("presents dispatch as an approval-first comparison board", () => {
    const dispatch = source("src/features/dispatch/DispatcherIntelligence.tsx");
    expect(dispatch).toContain("Crew assignment board");
    expect(dispatch).toContain("Human approval required");
    expect(dispatch).toContain("visitLabels");
    expect(dispatch).toContain("Travel time isn’t scored because routing data isn’t available.");
    expect(dispatch).not.toContain("setVisit");
    expect(dispatch).not.toContain("setCrew");
  });
});
