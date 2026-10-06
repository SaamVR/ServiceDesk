import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uiStateScenarios, tourScenarios } from "../../src/features/product/story-model";

describe("accessibility and responsive evidence contracts", () => {
  it("keeps UI state cards screen-reader addressable", () => {
    expect(uiStateScenarios.map((scenario) => scenario.state)).toEqual(["loading", "empty", "error"]);
    expect(uiStateScenarios.every((scenario) => scenario.ariaLive === "polite" || scenario.ariaLive === "assertive")).toBe(true);
    expect(uiStateScenarios.find((scenario) => scenario.state === "error")?.ariaLive).toBe("assertive");
  });

  it("keeps every tour step routed and proof-bounded", () => {
    let count = 0;
    for (const scenario of tourScenarios) {
      for (const step of scenario.steps) {
        count += 1;
        expect(step.routeHref.startsWith("/")).toBe(true);
        expect(["FIXTURE_UI_ONLY", "SANDBOX", "CONFIGURATION_BLOCKED"]).toContain(step.proofBoundary);
      }
    }
    expect(count).toBeGreaterThan(10);
  });

  it("does not allow provider verified claims in showcase data", () => {
    const serialized = JSON.stringify(tourScenarios);
    expect(serialized).not.toContain("PROVIDER_VERIFIED");
    expect(serialized).not.toContain("LIVE receipt");
    expect(serialized).not.toContain("Delivered proof");
  });
  it("provides a keyboard skip path into the staff workspace", () => {
    const shell = readFileSync(join(process.cwd(), "src/components/product/StaffAppShell.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(shell).toContain('href="#app-main-content"');
    expect(shell).toContain('id="app-main-content"');
    expect(shell).toContain("tabIndex={-1}");
    expect(css).toContain(".app-skip-link:focus-visible");
  });

  it("uses the defined hover token for authenticated entry controls", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain(".app-auth-entry-link:hover { background: var(--app-accent-hover)");
    expect(css).not.toContain("var(--app-accent-strong)");
  });

});
