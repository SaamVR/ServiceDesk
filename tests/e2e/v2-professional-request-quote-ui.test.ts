import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional request and quote UI", () => {
  it("turns requests into a focused intake and quote-readiness workspace", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Request intake workspace");
    expect(route).toContain("Quote readiness");
    expect(route).toContain("More information needed");
    expect(route).toContain("Ready to price");
    expect(route).toContain("calculateOperationalQuote");
  });

  it("makes quote financial state and next action immediately visible", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Quote financial summary");
    expect(route).toContain("Ready to send");
    expect(route).toContain("Waiting for customer");
    expect(route).toContain("Ready to schedule");
    expect(route).toContain("sendOperationalQuote");
  });

  it("preserves customer and property context instead of raw request ids", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("selectedRequestCustomer?.displayName");
    expect(route).toContain("selectedRequestProperty?.address");
    expect(route).toContain("selectedQuoteCustomer?.displayName");
    expect(route).toContain("selectedQuoteProperty?.label");
  });

  it("has responsive queue/detail layout contracts", () => {
    const css = source("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain("salesWorkspace");
    expect(css).toContain("grid-template-columns: 310px minmax(0, 1fr)");
    expect(css).toContain("@media (max-width: 720px)");
  });
});
