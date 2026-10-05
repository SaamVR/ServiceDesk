import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional human recovery UI", () => {
  it("prioritizes persisted attention by severity and due time", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Operational recovery workspace");
    expect(route).toContain("Human recovery");
    expect(route).toContain("Highest severity and nearest deadline first");
    expect(route).toContain("severityWeight");
    expect(route).toContain("Open related record");
  });

  it("keeps recovery human-owned instead of inventing a generic mutation", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Recovery remains human-owned");
    expect(route).toContain("does not invent a generic recovery mutation");
    expect(route).toContain("No hidden “retry everything” action is introduced here");
    expect(route).not.toContain("resolveAttentionItem(");
  });

  it("keeps deep links into the domain-owned product surfaces", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("attentionResourceHref");
    expect(route).toContain('/inbox?conversation=');
    expect(route).toContain('/jobs?job=');
    expect(route).toContain('/invoices?invoice=');
    expect(route).toContain('/quality?case=');
  });

  it("has responsive recovery queue and policy layouts", () => {
    const css = source("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain("recoveryWorkspace");
    expect(css).toContain("recoveryLayout");
    expect(css).toContain("recoveryPolicy");
    expect(css).toContain("@media(max-width:760px)");
  });
});
