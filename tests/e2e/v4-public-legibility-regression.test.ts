import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(),path),"utf8");
const cleanPages = read("src/features/product/BrightProductPages.module.css");
const tour = read("src/app/tour/tour.module.css");
const interactions = read("src/features/product/BrightPageInteractions.tsx");
const typography = (css: string) =>
  [...css.matchAll(/font-size:\s*([0-9]*\.?[0-9]+)rem\b/g)].map(m => Number(m[1]));

describe("V4 secondary public page legibility and usable controls", () => {
  it("does not force tiny explicit rem fonts into editorial copy, disclaimers, or interactive tabs", () => {
    for (const [name, css] of [["marketing", cleanPages], ["tour", tour]] as const) {
      const sizes = typography(css);
      expect(sizes.length, name).toBeGreaterThan(30);
      expect(Math.min(...sizes), name).toBeGreaterThanOrEqual(0.75);
    }
  });
  it("keeps tabs keyboard-focusable and selected states distinguished without a backend request", () => {
    expect(interactions).toContain('type="button"');
    expect(interactions).toContain("aria-pressed={chosen === step.id}");
    expect(interactions).toContain("aria-pressed={selected === provider.id}");
    expect(interactions).toContain("aria-pressed={tab ===");
    expect(interactions).toContain('aria-live="polite"');
    expect(cleanPages).toContain(".explorerTab:focus-visible");
    expect(cleanPages).toContain(".providerTab:focus-visible");
    expect(cleanPages).toContain(".quoteTabs button:focus-visible");
    expect(cleanPages).toContain("[aria-pressed=true]");
  });
  it("preserves not-live and no-provider guarantees visibly rather than falsely implying production delivery", () => {
    expect(interactions).toContain("Provider verification pending");
    expect(interactions).toContain("Sandbox verification required");
    expect(interactions).toContain("not a ServiceDesk subscription plan");
    expect(tour).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cleanPages).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
