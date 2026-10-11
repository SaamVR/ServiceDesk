import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BrightProductExperience } from "@/features/product/BrightProductExperience";
import { ConsultationPlanner, IntegrationExplorer, QuoteExplorer, WorkflowExplorer } from "@/features/product/BrightPageInteractions";
import { publicProductPageCopy } from "@/features/product/StaticProductPage";

vi.mock("next/link", () => ({ default: "a" }));

const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const kinds = ["features", "cleaning", "integrations", "pricing", "contact", "help", "privacy", "terms"] as const;
const markup = (kind: typeof kinds[number]) => renderToStaticMarkup(createElement(BrightProductExperience, {
  kind, title: publicProductPageCopy[kind].title, description: publicProductPageCopy[kind].description,
}));

describe("ServiceDesk V4 Clean Air public-page system", () => {
  it("presents eight separate purposeful editorials with one page H1 and unique visual landmarks", () => {
    const seen = new Set<string>();
    const labels = [
      "Illustrative request-to-visit workboard",
      "Bright, tidy home illustrating cleaning-service operations",
      "Illustrative integration control system",
      "Example service quote with transparent total and deposit",
      "An illustrative cleaning workflow conversation",
      "help overview",
      "privacy overview",
      "terms overview",
    ];
    kinds.forEach((kind, i) => {
      const html = markup(kind);
      expect(html).toContain(`data-bright-page="${kind}"`);
      expect(html).toContain('id="bright-product-heading"');
      expect(html).toContain(`aria-label="${labels[i]}"`);
      expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
      expect(html).toContain(publicProductPageCopy[kind].title.replaceAll("&", "&amp;"));
      expect(html).toContain('data-public-primary');
      expect(html).toContain('data-public-secondary');
      expect(html).toContain('href="/tour"');
      seen.add(html);
    });
    expect(seen.size).toBe(8);
  });

  it("features: illustrates a connected workflow and keeps ownership visible", () => {
    const html = markup("features");
    expect(html).toContain("From the first hello to the finishing touch.");
    expect(html).toContain("Good conversations make great service.");
    expect(html).toContain("AI helps with the routine. Your team makes the calls.");
    expect(html).toContain("Human review");
    expect(html).not.toContain("AI automatically confirms");
  });

  it("cleaning: shows cleaning-specific journey instead of generic SaaS cards", () => {
    const html = markup("cleaning");
    expect(html).toContain("A thoughtful service needs a thoughtful system.");
    for (const term of ["Enquiry", "Quote", "Schedule", "On site", "Aftercare"]) expect(html).toContain(term);
    expect(html).toContain('aria-label="Naturally lit, spotless contemporary kitchen"');
    expect(html).not.toContain("10k satisfied customers");
  });

  it("integrations: never mistakes architecture for live verification", () => {
    const html = markup("integrations");
    expect(html).toContain("WhatsApp Cloud API");
    expect(html).toContain("Provider verification pending");
    expect(html).toContain("sandbox");
    expect(html).toContain("live connected-provider telemetry");
    expect(html).toContain("Know exactly what a connection is doing.");
    expect(html).not.toContain("Everything connected and live");
  });

  it("pricing: shows only the exact sanctioned illustrative quote and safety boundaries", () => {
    const html = markup("pricing");
    for (const amount of ["$340", "$85", "$255"]) expect(html).toContain(amount);
    expect(html).toContain("3 / 2");
    expect(html).toContain("Oven clean");
    expect(html).toContain("240 + 30 min");
    expect(html).toContain("configured");
    expect(html).toContain("not a ServiceDesk subscription");
    expect(html).not.toContain("Buy subscription");
  });

  it("contact: interactive preparation is local, never a fake meeting submission", () => {
    const html = markup("contact");
    expect(html).toContain("Tell us about the work");
    expect(html).toContain("What would you like to improve?");
    expect(html).toContain("No details are submitted or stored");
    expect(html).toContain('href="/tour"');
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("Meeting confirmed");
  });

  it("help, policy and legal pages remain accessible without making unreviewed legal claims", () => {
    expect(markup("help")).toContain("<details");
    expect(markup("help")).toContain("Getting started");
    expect(markup("help")).toContain("Daily operations");
    expect(markup("privacy")).toContain("Workspace isolation");
    expect(markup("terms")).toContain("Product terms and readiness");
    for (const kind of ["privacy", "terms"] as const) {
      const html = markup(kind);
      expect(html).toContain("Final legal notices must be reviewed");
      expect(html).not.toContain("Legally guaranteed");
    }
  });

  it("all interactive controls have explicit pressed state, a real state setter and a no-provider disclaimer", () => {
    const components = [WorkflowExplorer, IntegrationExplorer, QuoteExplorer, ConsultationPlanner];
    for (const Component of components) {
      const html = renderToStaticMarkup(createElement(Component));
      expect(html).toContain('aria-label="');
      expect(html).not.toContain('action="/api/');
    }
    const source = file("src/features/product/BrightPageInteractions.tsx");
    expect(source).toContain("useState");
    expect(source).toContain("aria-pressed={");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("No details are submitted or stored.");
    expect(source).toContain("not live connected-provider telemetry");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("form action=");
  });

  it("reuses homepage-approved style without changing home or signed-in staff UI", () => {
    const home = file("src/app/page.tsx");
    const shell = file("src/components/shell/MarketingShell.tsx");
    const pages = file("src/features/product/StaticProductPage.tsx");
    const css = file("src/features/product/BrightProductPages.module.css");
    expect(home).toContain("<BrightHomeExperience");
    expect(home).not.toContain("BrightProductExperience");
    expect(shell).toContain("brightEdition");
    expect(pages).toContain("SERVICEDESK_V4_PUBLIC_PAGES_ENABLED");
    expect(pages).toContain("<BrightProductExperience");
    expect(css).toContain("#f7fbfa");
    expect(css).toContain("#fa785f");
    expect(css).toContain("@media (max-width: 580px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(file("src/components/product/StaffAppShell.tsx")).not.toContain("brightEdition");
  });

  it("keeps restricted QA registration distinct from public owner signup", () => {
    const shell = file("src/components/shell/MarketingShell.tsx");
    const home = file("src/app/page.tsx");
    expect(shell).toContain("ownerRegistrationPubliclyAvailable()");
    expect(home).toContain("ownerRegistrationPubliclyAvailable()");
    expect(shell).toContain("marketingRegistrationEntry(registrationEnabled)");
    expect(shell).toContain('href="/auth/sign-in"');
  });
});
