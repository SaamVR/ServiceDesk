import { describe, expect, it } from "vitest";
import { uiStateScenarios, tourScenarios } from "../../src/features/product/story-model";

describe("accessibility and responsive evidence contracts", () => {
  it("keeps UI state cards screen-reader addressable", () => {
    expect(uiStateScenarios.map((scenario) => scenario.state)).toEqual(["loading", "empty", "error"]);
    expect(uiStateScenarios.every((scenario) => scenario.ariaLive === "polite" || scenario.ariaLive === "assertive")).toBe(true);
    expect(uiStateScenarios.find((scenario) => scenario.state === "error")?.ariaLive).toBe("assertive");
  });

  it("keeps every tour step routed and proof-bounded", () => {
    const steps = tourScenarios.flatMap((scenario) => scenario.steps);

    expect(steps.length).toBeGreaterThan(10);
    expect(steps.every((step) => step.routeHref.startsWith("/"))).toBe(true);
    expect(steps.every((step) => ["FIXTURE_UI_ONLY", "SANDBOX", "CONFIGURATION_BLOCKED"].includes(step.proofBoundary))).toBe(true);
  });

  it("does not allow provider verified claims in showcase data", () => {
    const serialized = JSON.stringify(tourScenarios);

    expect(serialized).not.toContain("PROVIDER_VERIFIED");
    expect(serialized).not.toContain("LIVE receipt");
    expect(serialized).not.toContain("Delivered proof");
  });
});
