import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/components/product/StaffCleanAirV4.module.css"), "utf8");
const oldCss = readFileSync(join(process.cwd(), "src/components/product/StaffWorkspaceV3.module.css"), "utf8");
const shell = readFileSync(join(process.cwd(), "src/components/product/StaffAppShell.tsx"), "utf8");

function luminance(hex: string): number {
  return [1, 3, 5]
    .map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}
function contrast(foreground: string, background: string): number {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
function specificity(selector: string): number {
  return (selector.match(/\.[a-zA-Z][\w-]*/g) ?? []).length
    + (selector.match(/\[aria-current/g) ?? []).length;
}
function ruleBody(selector: string): string {
  const start = css.indexOf(selector + " {");
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start + selector.length + 2).split("}")[0];
}

describe("V4 Studio OS sidebar visibility", () => {
  it("has a deterministic V4 cascade above the legacy dark rail", () => {
    expect(shell).toContain("cleanStyles.cleanShell");
    expect(shell).toContain("styles.v3Shell");
    const oldSelector = ".v3Shell :global(.app-sidebar) .navLink";
    const newSelector = ".cleanShell:global(.app-shell) :global(.app-sidebar) .navLink";
    expect(oldCss).toContain(oldSelector);
    expect(css).toContain(newSelector);
    expect(specificity(newSelector)).toBeGreaterThan(specificity(oldSelector));
    expect(specificity(newSelector + '[aria-current="page"]'))
      .toBeGreaterThan(specificity(oldSelector + '[aria-current="page"]'));
    expect(css).toContain("background: linear-gradient(180deg,#fff 0%,#fbfdfc 72%,#f6fbf8 100%)");
  });

  it("keeps sidebar scrollable, with a light color scheme", () => {
    const rail = ruleBody(".cleanShell:global(.app-shell) :global(.app-sidebar)");
    expect(rail).toContain("color-scheme: light");
    expect(rail).toContain("scrollbar-width: thin");
    expect(rail).toContain("scrollbar-gutter: stable");
    expect(rail).toContain("overscroll-behavior-y: contain");
  });

  it("keeps text, icons and labels WCAG AA readable on white", () => {
    for (const foreground of ["#49695d", "#3a5d52", "#426e62", "#365b50", "#526c60", "#527368"]) {
      expect(contrast(foreground, "#ffffff"), foreground).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast("#0f7366", "#e3f7ef")).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain("color: #49695d !important");
    expect(css).toContain("color: #426e62");
  });

  it("keeps selected navigation and focus rings visible independent of CSS order", () => {
    const selector = '.cleanShell:global(.app-shell) :global(.app-sidebar) .navLink[aria-current="page"]';
    const active = ruleBody(selector);
    expect(active).toContain("background: #e3f7ef");
    expect(active).toContain("color: #0f7366");
    expect(active).toContain("inset 3px 0 #2da68e");
    expect(css).toContain(selector + " :global(.app-nav-icon)");
    expect(css).toContain("outline: 3px solid #167c73");
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
  });

  it("keeps the secondary tools disclosure readable and deep links expanded", () => {
    expect(shell).toContain('open={group.modules.some(moduleIsActive) ? true : undefined}');
    expect(shell).toContain("className={styles.moreToolsTrigger}");
    expect(css).toContain(".cleanShell:global(.app-shell) .moreToolsTrigger");
    expect(css).toContain("min-height: 45px");
    expect(css).toContain("color: #365b50");
    expect(css).toContain("opacity: 1");
  });

  it("keeps a legible mobile drawer with real keyboard controls", () => {
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain(".cleanShell:global(.app-shell) :global(.app-mobile-links) .navLink");
    expect(css).toContain("min-height: 48px; color: #365d50");
    expect(css).toContain("background: #e1f7eb");
    expect(css).toContain("color: #4b6d5f !important");
    expect(shell).toContain('aria-label={mobileNavOpen ? "Close workspace navigation" : "Open workspace navigation"}');
    expect(shell).toContain("handleMobileNavigationKeyDown");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
