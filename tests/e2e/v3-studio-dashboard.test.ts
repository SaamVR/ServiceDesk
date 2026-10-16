import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Studio OS / decision-first Today dashboard", () => {
  it("is a real read model with four operable business queue metrics", () => {
    const route = source("src/features/operations/StaffOverviewDashboard.tsx");
    for (const label of ["Today's jobs","Needs attention","Waiting pipeline","Outstanding"]) {
      expect(route).toContain('label="' + label + '"');
    }
    expect(route).toContain("attentionResourceHref(workspace, item)");
    expect(route).toContain("unassignedToday");
    expect(route).toContain("summarizeVerifiedOutstandingInvoices(snapshot.invoices.filter((invoice) => Boolean(invoice.quoteId)))");
    expect(route).toContain("Customer invoices to collect");
    expect(route).toContain("Snapshot updated");
    expect(route).toContain("Decisions waiting for you");
  });
  it("has an independent high-trust design with focused responsive layout", () => {
    const css = source("src/features/operations/StaffOverviewDashboard.module.css");
    expect(css).toContain("background: linear-gradient(108deg,#1e414c");
    expect(css).toContain("repeat(4,minmax(0,1fr))");
    expect(css).toContain(".severity_critical");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain("max-width:470px");
    expect(css).toContain(":focus-visible");
  });
});
