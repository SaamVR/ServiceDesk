import { describe, expect, it } from "vitest";
import { jobsActionReturnPrefix, scheduleActionReturnPrefix } from "@/features/operations/operations-action-return";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Staff operational action return context", () => {
  it("retains a job's filtered queue even after its state changes", () => {
    expect(jobsActionReturnPrefix("vis/123", "review")).toBe("queue=review&job=vis%2F123&");
    expect(jobsActionReturnPrefix("v 2", "all")).toBe("job=v+2&");
    expect(jobsActionReturnPrefix("", "needs-crew")).toBe("queue=needs-crew&");
  });
  it("whitelists queues and never forwards arbitrary query strings", () => {
    expect(jobsActionReturnPrefix("v1", "//evil.com")).toBe("job=v1&");
    expect(jobsActionReturnPrefix("v1", "all?error=whatever")).toBe("job=v1&");
    expect(scheduleActionReturnPrefix("unassigned")).toBe("queue=unassigned&");
    expect(scheduleActionReturnPrefix("other")).toBe("");
  });
  it("is wired to Job/Dispatch action redirects without affecting mutation rules", () => {
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    expect(route).toContain('jobsActionReturnPrefix(visitId, selectedJobQueue)');
    expect(route).toContain('scheduleActionReturnPrefix(selectedScheduleQueue)');
    expect(route).toContain('await transitionOperationalVisit(workspaceSlug, visitId, action)');
    expect(route).toContain('await assignOperationalCrew(workspaceSlug, visitId, crewId, expectedVersion)');
  });
});
