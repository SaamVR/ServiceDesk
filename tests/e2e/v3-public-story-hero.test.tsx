import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProductStoryHero } from "@/components/shell/ProductStoryHero";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("V3 distinct public-page product stories", () => {
  const views = [
    ["features", "Feature workflow from intake through quality"],
    ["pricing", "Illustrative service quote breakdown, not subscription prices"],
    ["integrations", "Integration readiness categories, not live provider status"],
    ["contact", "ServiceDesk walkthrough preparation agenda"],
  ] as const;

  it("renders four distinct accessible storyboards instead of reusing the home workflow card", () => {
    const markup = views.map(([kind, label]) => {
      const html = renderToStaticMarkup(createElement(ProductStoryHero, { kind }));
      expect(html).toContain('aria-label="' + label + '"');
      expect(html).toContain("<aside");
      expect(html).not.toContain("CUSTOMER INTAKE</p>");
      return html;
    });
    for (let i = 0; i < markup.length; i++) {
      for (let j = i + 1; j < markup.length; j++) {
        expect(markup[i]).not.toBe(markup[j]);
      }
    }
  });

  it("explains four operational ownership stages without inventing live customer records", () => {
    const html = renderToStaticMarkup(createElement(ProductStoryHero, { kind: "features" }));
    for (const step of ["Capture &amp; qualify", "Price &amp; approve", "Schedule &amp; deliver", "Collect &amp; recover"]) {
      expect(html).toContain(step);
    }
    expect(html).toContain("Human handover");
    expect(html).toContain("Staff review");
    expect(html).toContain("Decisions and statuses are stored by the application");
  });

  it("uses the sanctioned illustrative rate-rule fixture but does not market SaaS pricing", () => {
    const html = renderToStaticMarkup(createElement(ProductStoryHero, { kind: "pricing" }));
    expect(html).toContain("$340");
    expect(html).toContain("$85");
    expect(html).toContain("$255");
    expect(html).toContain("240 + 30 min");
    expect(html).toContain("Illustrative");
    expect(html).toContain("Not ServiceDesk subscription pricing");
    expect(html).toContain("not a live offer");
    expect(html).not.toContain("Buy now");
  });

  it("shows honest integration release categories without claiming verified Meta, Calendar or payments", () => {
    const html = renderToStaticMarkup(createElement(ProductStoryHero, { kind: "integrations" }));
    for (const term of ["WhatsApp Cloud API", "Google Calendar", "Payments", "AI assistant"]) {
      expect(html).toContain(term);
    }
    expect(html).toContain("Verification pending");
    expect(html).toContain("Sandbox only");
    expect(html).toContain("Human reviewed");
    expect(html).toContain("not connected provider health telemetry");
    expect(html).not.toContain("All systems operational");
  });

  it("offers useful consultation preparation instead of a nonfunctional lead form", () => {
    const html = renderToStaticMarkup(createElement(ProductStoryHero, { kind: "contact" }));
    expect(html).toContain("Map your current work");
    expect(html).toContain("Identify operational friction");
    expect(html).toContain("Review launch requirements");
    expect(html).toContain('href="/tour"');
    expect(html).toContain("not a submitted booking");
    expect(html).not.toContain("<form");
  });

  it("connects the four specialized heroes while preserving the homepage's existing flow", () => {
    const shell = source("src/components/shell/MarketingShell.tsx");
    const page = source("src/features/product/StaticProductPage.tsx");
    const home = source("src/app/page.tsx");
    const css = source("src/components/shell/ProductStoryHero.module.css");
    expect(shell).toContain("heroStory ? <ProductStoryHero kind={heroStory} /> : <OperationalFlowHero />");
    expect(page).toContain('kind === "features" || kind === "integrations" || kind === "pricing" || kind === "contact"');
    expect(home).not.toContain("heroStory=");
    expect(css).toContain("@media (max-width: 540px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".tourLink:focus-visible");
  });
});
