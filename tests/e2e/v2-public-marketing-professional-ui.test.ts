import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional public product presentation", () => {
  it("positions the homepage as the current operational product rather than V1 evidence", () => {
    const home = source("src/app/page.tsx");
    expect(home).toContain("Run cleaning operations from enquiry to paid job.");
    expect(home).toContain("one operational workspace for residential cleaning teams");
    expect(home).not.toContain("ServiceDesk AI V1");
  });

  it("keeps internal acceptance vocabulary off normal marketing sections", () => {
    const sections = source("src/features/product/ProductSections.tsx");
    const publicSections = sections.split("function TourStaticAnchors")[0];
    expect(publicSections).toContain("Deterministic pricing");
    expect(publicSections).toContain("Provider status stays clear at a glance");
    expect(publicSections).toContain("Work the exceptions first");
    expect(publicSections).not.toContain("Frozen pricing fixture");
    expect(publicSections).not.toContain("Chat 2");
    expect(publicSections).not.toContain("Configuration blocked");
    expect(publicSections).not.toContain("Start travel · preview");
  });

  it("uses customer-facing integration states on public routes", () => {
    const story = source("src/features/product/story-model.ts");
    expect(story).toContain('state: "Provider verification pending"');
    expect(story).toContain('state: "Sandbox mode"');
    expect(story).toContain('state: "Policy bounded"');
    expect(story).not.toContain("Awaiting Chat 2");
  });

  it("keeps help, contact and policy pages independent from the controlled tour harness", () => {
    const page = source("src/features/product/StaticProductPage.tsx");
    expect(page).toContain("Find the operational answer quickly.");
    expect(page).toContain("Bring the workflow you want to improve.");
    expect(page).toContain("Tenant isolation and clear operational authority.");
    expect(page).not.toContain("TourScenarioList");
    expect(page).not.toContain("ServiceDesk AI V1");
    expect(page).not.toContain("Chat 2");
    expect(page).not.toContain("product UI copy");
  });

  it("uses the real product feature route as the default marketing CTA", () => {
    const shell = source("src/components/shell/MarketingShell.tsx");
    expect(shell).toContain('primaryHref = "/features"');
    expect(shell).toContain('primaryLabel = "Explore platform"');
    expect(shell).toContain("hero-capabilities");
    expect(shell).not.toContain('primaryHref = "/tour"');
  });

  it("keeps every primary marketing destination visible on narrow screens", () => {
    const shell = source("src/components/shell/MarketingShell.tsx");
    const css = source("src/app/globals.css");
    expect(shell).toContain('className="site-nav site-primary-nav"');
    expect(css).toContain(".site-primary-nav {");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain(".site-primary-nav a:last-child");
    expect(css).toContain("grid-column: 1 / -1");
  });

  it("has dedicated responsive hero composition instead of relying on the global h1 scale", () => {
    const css = source("src/app/globals.css");
    expect(css).toContain(".marketing-hero-copy h1");
    expect(css).toContain(".hero-capabilities");
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("@media (max-width: 420px)");
  });
});
