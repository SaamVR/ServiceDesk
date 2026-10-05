import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional schedule UI", () => {
  it("combines dispatch, seven-day planning and booking capacity", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Scheduling and dispatch workspace");
    expect(route).toContain("Operations planning");
    expect(route).toContain("<h2>Planning &amp; dispatch</h2>");
    expect(route).toContain("DispatcherIntelligence");
    expect(route).toContain("Next 7 days");
    expect(route).toContain("Accepted work awaiting a slot");
    expect(route).toContain("Unscheduled work");
  });

  it("preserves authoritative crew assignment and slot hold boundaries", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("assignOperationalCrew");
    expect(route).toContain("holdOperationalSlot");
    expect(route).toContain('name="expectedVersion"');
    expect(route).toContain("Holding capacity never implies payment or a confirmed visit");
  });

  it("shows readable customer, crew and request context", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("customer?.displayName");
    expect(route).toContain("crew?.name");
    expect(route).toContain("Crew unassigned");
    expect(route).toContain("Visitor enquiry");
  });

  it("supports responsive planning layouts", () => {
    const css = source("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain("scheduleWorkspace");
    expect(css).toContain("schedulePlanningGrid");
    expect(css).toContain("@media(max-width:760px)");
  });
});
