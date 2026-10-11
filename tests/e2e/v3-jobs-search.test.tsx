import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filterJobsSearch, jobsActionFeedbackPrefix, jobsQueueHref, normalizeJobsSearch } from "@/features/operations/jobs-queue";
import { JobQueueSearch } from "@/features/operations/JobQueueSearch";

describe("authorized staff job search", () => {
  const rows = [
    { id: "v1", customer: "Sam Blake", service: "Move out clean", crew: "Team South" },
    { id: "v2", customer: "Avery", service: "Regular clean", crew: "Team North" },
  ];
  it("matches several terms across customer, service and crew", () => {
    expect(filterJobsSearch(rows, "SAM CLEAN", (row) => [row.customer, row.service, row.crew]).map((r) => r.id)).toEqual(["v1"]);
    expect(filterJobsSearch(rows, "north", (row) => [row.customer, row.service, row.crew]).map((r) => r.id)).toEqual(["v2"]);
    expect(normalizeJobsSearch(" ".repeat(8) + "A".repeat(130))).toHaveLength(90);
  });
  it("keeps queue and search through selection and server-action feedback", () => {
    expect(jobsQueueHref("review", "job/7", "Sam & Sons")).toBe("?queue=review&job=job%2F7&search=Sam+%26+Sons");
    expect(jobsActionFeedbackPrefix("review", "job/7", "Sam & Sons")).toBe("queue=review&job=job%2F7&search=Sam+%26+Sons&");
  });
  it("renders an accessible GET form with a clear-search action", () => {
    const html = renderToStaticMarkup(createElement(JobQueueSearch, { queue: "review", search: "Sam", visible: 1, total: 5 }));
    expect(html).toContain('role="search"');
    expect(html).toContain('name="search"');
    expect(html).toContain('name="queue"');
    expect(html).toContain('role="status"');
    const source = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    expect(source).toContain("filterJobsSearch(statusVisits, jobSearch");
    expect(source).toContain("jobsActionFeedbackPrefix(jobQueue, visitId, jobSearch)");
  });
});
