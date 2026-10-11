import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { presentationSlides, tourScenarios } from "@/features/product/story-model";

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V4 Clean Air guided tour and controlled sandbox handoff", () => {
  it("keeps the real browser sandbox accessible but separate from the cleaner marketing tour", () => {
    const page = file("src/app/tour/page.tsx");
    expect(page).toContain('<MarketingShell');
    expect(page).toContain('brightEdition');
    expect(page).toContain('href="/sandbox"');
    expect(page).toContain("Try the interactive sandbox");
    expect(page).toContain("Five connected steps.");
    expect(page).toContain("No real charges, messages or bookings.");
    expect(page).not.toContain("OperationalFixtureRoute");
    const sandbox = file("src/app/sandbox/page.tsx");
    expect(sandbox).toContain("SandboxJourney");
    expect(sandbox).toContain("index: false");
    expect(sandbox).toContain("follow: false");
  });

  it("uses editorial H1/H2 landmarks and a distinctive interactive photo hero", () => {
    const page = file("src/app/tour/page.tsx");
    expect(page).toContain('id="public-main-content"');
    expect(page).toContain('tabIndex={-1}');
    expect(page).toContain('id="tour-title"');
    expect(page).toContain('id="journey-heading"');
    expect(page).toContain('id="scenarios-heading"');
    expect(page).toContain('id="quote-tour-heading"');
    expect(page).toContain('id="trust-title"');
    expect(page).toContain('data-tour-hero');
    expect(page).toContain('aria-label="Bright cleaning workspace and illustrative service journey"');
    expect(page).not.toContain("Seven connected steps.");
  });

  it("preserves presentation-deck deep-link targets as visible page landmarks", () => {
    const page = file("src/app/tour/page.tsx");
    const targets = new Set(["pain", "promise", "pricing", "contact", ...tourScenarios.map(x => x.id)]);
    for (const item of presentationSlides) {
      const id = item.tourHref.replace("/tour#", "");
      expect(targets.has(id)).toBe(true);
      if (tourScenarios.some(x => x.id === id)) {
        expect(page).toContain("id={scenario.id}");
      } else {
        expect(page).toContain(`id="${id}"`);
      }
    }
  });

  it("reuses real proof-boundary scenarios without inventing live provider evidence", () => {
    const page = file("src/app/tour/page.tsx");
    expect(page).toContain('tourScenarios.map');
    expect(page).toContain("scenario.steps.map");
    expect(page).not.toContain("scenario.proofBoundary");
    expect(page).toContain('step.proofBoundary');
    expect(page).toContain("no live provider evidence");
    for (const scenario of tourScenarios) {
      expect(scenario.providerEvidence).toBe("SYNTHETIC_UNTIL_CHAT_2_VERIFIED");
      expect(scenario.steps.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps rate-rule quote totals and provider-send disclaimers transparent", () => {
    const page = file("src/app/tour/page.tsx");
    for (const amount of ["$340", "$85", "$255"]) expect(page).toContain(amount);
    expect(page).toContain("not a live price, subscription fee or payment receipt");
    expect(page).toContain("AI can prepare context for staff without quietly booking");
    expect(page).toContain('index: false');
    expect(page).not.toContain("Stripe live connected");
  });

  it("uses the V4 porcelain, teal, restrained coral and accessible mobile/reduced-motion styles", () => {
    const css = file("src/app/tour/tour.module.css");
    expect(css).toContain("--ink: #203638");
    expect(css).toContain("--aqua: #219d9b");
    expect(css).toContain("--coral: #bd4b36");
    expect(css).toContain("Manrope");
    expect(css).toContain("DM Sans");
    expect(css).toContain("@media (max-width: 580px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".scenarioCard summary:focus-visible");
    expect(css).toContain(".primaryAction:focus-visible");
  });
});
