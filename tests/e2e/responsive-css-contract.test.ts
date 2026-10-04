import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/responsive-a11y.css"), "utf8");

describe("responsive accessibility stylesheet", () => {
  it("keeps the global skip link visible on keyboard focus", () => {
    expect(css).toContain(".skip-link");
    expect(css).toContain(".skip-link:focus-visible");
    expect(css).toContain("#main-content");
  });

  it("keeps tour and presentation routes mobile-safe", () => {
    expect(css).toContain(".scenario-stack");
    expect(css).toContain(".routed-steps li");
    expect(css).toContain(".slide-index");
    expect(css).toContain("overflow-x: auto");
  });

  it("does not depend on scroll snapping when reduced motion is requested", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("scroll-snap-type: none");
    expect(css).toContain("scroll-snap-align: none");
  });

  it("keeps narrow mobile text from forcing horizontal overflow", () => {
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain("grid-template-columns: 1fr");
  });
});
