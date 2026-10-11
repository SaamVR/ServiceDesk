import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filterJobsQueue, indexJobProgress, jobsQueueHref, normalizeJobsQueue } from "../../src/features/operations/jobs-queue";
import { JobQueueFilters } from "../../src/features/operations/JobQueueFilters";

const visits = [
  { id: "unassigned", status: "CONFIRMED", crewId: undefined },
  { id: "enroute", status: "EN_ROUTE", crewId: "crew-a" },
  { id: "review", status: "PENDING_REVIEW", crewId: "crew-a" },
  { id: "done", status: "COMPLETED", crewId: "crew-a" },
  { id: "cancelled", status: "CANCELLED", crewId: undefined },
];

describe("V3 live field work queues", () => {
  it("segments real visits without treating cancelled visits as crew gaps", () => {
    expect(filterJobsQueue(visits, "needs-crew").map((v) => v.id)).toEqual(["unassigned"]);
    expect(filterJobsQueue(visits, "underway").map((v) => v.id)).toEqual(["enroute"]);
    expect(filterJobsQueue(visits, "review").map((v) => v.id)).toEqual(["review"]);
    expect(filterJobsQueue(visits, "closed").map((v) => v.id)).toEqual(["done", "cancelled"]);
    expect(normalizeJobsQueue("invalid")).toBe("all");
  });

  it("keeps active queue and record identity in safe links", () => {
    expect(jobsQueueHref("all", "v/1")).toBe("?job=v%2F1");
    expect(jobsQueueHref("needs-crew", "v/1")).toBe("?queue=needs-crew&job=v%2F1");
  });

  it("indexes field evidence and checklist counts in one pass", () => {
    const progress = indexJobProgress(
      [{ visitId: "v1" }, { visitId: "v1" }, { visitId: "v2" }],
      [{ visitId: "v1", completed: true }, { visitId: "v1", completed: false }],
    );
    expect(progress.get("v1")).toEqual({ evidence: 2, checklist: 2, completed: 1 });
    expect(progress.get("v2")).toEqual({ evidence: 1, checklist: 0, completed: 0 });
  });

  it("renders five accessible navigation states derived from authorized visits", () => {
    const html = renderToStaticMarkup(createElement(JobQueueFilters, { queue: "review", visits }));
    expect(html).toContain('aria-label="Job status filters"');
    expect(html).toContain("Awaiting review");
    expect(html).toContain('aria-current="page"');
  });

  it("wires visible Jobs filtering without changing server-action truth", () => {
    const source = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const page = source("src/app/app/[workspace]/jobs/page.tsx");
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(page).toContain("selectedJobQueue={query.queue}");
    expect(route).toContain("filterJobsQueue(orderedVisits, queue)");
    expect(route).toContain("indexJobProgress(data.visitEvidence, data.visitChecklistItems)");
    expect(route).toContain("transitionOperationalVisit");
    expect(route).toContain("setOperationalChecklistItem");
  });
});
