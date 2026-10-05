import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);

describe("V2 recovery queue deep links", () => {
  it("maps supported attention resources into existing operational workspaces", () => {
    expect(route).toContain("function attentionResourceHref");
    expect(route).toContain('/inbox?conversation=');
    expect(route).toContain('/customers?customer=');
    expect(route).toContain('/requests?request=');
    expect(route).toContain('/quotes?quote=');
    expect(route).toContain('/jobs?job=');
    expect(route).toContain('/invoices?invoice=');
    expect(route).toContain('/quality?case=');
  });

  it("keeps unknown resource types reference-only instead of inventing mutations", () => {
    expect(route).toContain("Reference only");
    expect(route).toContain("This attention item has no supported deep link yet.");
    expect(route).toContain("Recovery remains human-owned");
  });

  it("exposes the same deep-link action on mobile recovery rows", () => {
    expect(route).toContain("renderMobileRow={(item) => {");
    expect(route).toContain('className="app-row-actions"');
    expect(route).toContain(">Open related record</a>");
  });
});
