import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EmptyState as ProductEmptyState } from "@/components/product/PagePrimitives";
import { buildStaffModuleHref } from "@/features/operations/staff-modules";

const route = () => readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");

describe("V3 operational empty-state next steps", () => {
  it("keeps an accessible, truthful empty-state action without fake records", () => {
    const href = buildStaffModuleHref("west/branch", "requests");
    const html = renderToStaticMarkup(createElement(ProductEmptyState, {
      title: "No quotes yet",
      description: "Calculated and saved quotes will appear here.",
      action: createElement("a", { href, className: "app-button-secondary" }, "Review requests"),
    }));
    expect(html).toContain("No quotes yet");
    expect(html).toContain('href="/app/west%2Fbranch/requests"');
    expect(html).toContain("Review requests");
    expect(html).toContain("app-empty-state");
  });

  it("offers a real next workflow from all six first-use empty states", () => {
    const source = route();
    const transitions = [
      ["No customers yet", "Open conversations", "inbox"],
      ["No requests in the queue", "Review conversations", "inbox"],
      ["No quotes yet", "Review service requests", "requests"],
      ["No jobs yet", "Open schedule", "schedule"],
      ["No customer invoices yet", "Review jobs", "jobs"],
      ["No quality cases", "Review completed jobs", "jobs"],
    ] as const;
    for (const [title, label, next] of transitions) {
      const start = source.indexOf('title="' + title + '"');
      expect(start, "Missing genuine empty state: " + title).toBeGreaterThan(-1);
      const segment = source.slice(start, start + 340);
      expect(segment).toContain('action={{ label: "' + label + '"');
      expect(segment).toContain('"' + next + '")');
    }
    expect(source).toContain('action={action ? <a className="app-button-secondary" href={action.href}>{action.label}</a> : undefined}');
  });

  it("does not imply settled revenue or provision external actions from empty views", () => {
    const source = route();
    expect(source).toContain("Quote-backed customer invoices will appear here after billable visits are created.");
    expect(source).toContain("Commercial accounts remain available in the adjacent workspace.");
    expect(source).toContain("Customer feedback that requires operational review will appear here.");
  });
});
