import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PricingControlCard } from "@/features/product/ProductSections";
const source = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
describe("ServiceDesk V3 public pricing truth", () => {
  it("labels all deterministic example amounts as illustrative, never live billing", () => {
    const markup = renderToStaticMarkup(createElement(PricingControlCard));
    expect(markup).toContain("Illustrative move-out cleaning quote");
    expect(markup).toContain('aria-label="Illustrative customer quote, not a live price"');
    expect(markup).toContain('role="note"');
    expect(markup).toContain("not ServiceDesk subscription pricing or a payment receipt");
    for (const amount of ["$340", "$85", "$255"]) expect(markup).toContain(amount);
  });
  it("does not advertise unavailable subscription price plans", () => {
    const page = source("src/features/product/StaticProductPage.tsx");
    expect(page).toContain("not ServiceDesk subscription plan prices");
    expect(page).toContain("configured rate rules and versioned approvals");
    expect(page).not.toContain("ServiceDesk plans start at $");
  });
  it("retains readable visual differentiation without changing customer billing semantics", () => {
    const css = source("src/app/globals.css");
    const sections = source("src/features/product/ProductSections.tsx");
    expect(css).toContain(".pricing-illustrative-note");
    expect(sections).toContain("moveOutFixture.serviceMinutes");
    expect(sections).toContain("Example amounts only.");
    expect(sections).not.toContain("Charge card");
  });
});
