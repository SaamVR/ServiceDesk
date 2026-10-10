import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MarketingShell } from "../../src/components/shell/MarketingShell";

vi.mock("next/link", () => ({ default: "a" }));
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V3 customer-facing product presentation", () => {
  const markup = renderToStaticMarkup(createElement(MarketingShell, {
    title: "Run cleaning operations from enquiry to paid job.",
    description: "One workspace for your team.",
    primaryHref: "/auth/sign-up",
    primaryLabel: "Create your workspace",
    secondaryHref: "/tour",
    secondaryLabel: "Explore the product",
  }, createElement("p", null, "Services and integrations")));

  it("presents actual workflow capabilities instead of invented client conversations or payments", () => {
    expect(markup).toContain("Customer intake");
    expect(markup).toContain("Quote with clarity.");
    expect(markup).toContain("Put the right crew on it.");
    expect(markup).toContain("Close the loop.");
    expect(markup).toContain("Human-approved decisions stay in control.");
    expect(markup).not.toContain("$340 total");
    expect(markup).not.toContain("SW11");
    expect(markup).not.toContain("FIXTURE_UI_ONLY");
  });

  it("retains semantic steps, buyer CTAs and real navigation paths", () => {
    expect(markup).toContain('aria-label="Four stages of the cleaning operations workflow"');
    expect(markup).toContain("<ol");
    expect(markup.match(/class="[^"]*flowStep/g)?.length).toBe(4);
    expect(markup).toContain('href="/auth/sign-up"');
    expect(markup).toContain('href="/tour"');
    expect(markup).toContain('href="/auth/sign-in"');
    expect(markup).toContain("Structured intake");
    expect(markup).toContain("Human-approved dispatch");
  });

  it("keeps the distinctive new hero responsive and honors reduced motion", () => {
    const css = source("src/components/shell/MarketingHeroV3.module.css");
    expect(css).toContain(".heroSection:global(.marketing-hero)");
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("@media (max-width: 540px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
