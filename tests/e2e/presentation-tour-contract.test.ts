import { describe, expect, it } from "vitest";
import { presentationSlides, tourScenarios } from "../../src/features/product/story-model";

const allowedStaticAnchors = new Set<string>(["pain", "promise", "pricing", "contact"]);

describe("presentation and tour linking contract", () => {
  it("keeps the ten-slide deck ordered and uniquely addressable", () => {
    expect(presentationSlides).toHaveLength(10);
    expect(new Set(presentationSlides.map((slide) => slide.order)).size).toBe(10);
    expect(presentationSlides[0].order).toBe(1);
    expect(presentationSlides[presentationSlides.length - 1].order).toBe(10);
  });

  it("links every routed slide to either a controlled scenario or approved static tour anchor", () => {
    const scenarioIds = new Set<string>(tourScenarios.map((scenario) => scenario.id));
    for (const slide of presentationSlides) {
      const anchor = slide.tourHref.replace("/tour#", "");
      expect(slide.tourHref.startsWith("/tour#")).toBe(true);
      expect(scenarioIds.has(anchor) || allowedStaticAnchors.has(anchor)).toBe(true);
    }
  });

  it("keeps route-linked scenarios away from unsupported claims", () => {
    for (const scenario of tourScenarios) {
      expect(scenario.providerEvidence).toBe("SYNTHETIC_UNTIL_CHAT_2_VERIFIED");
      expect(scenario.steps.every((step) => step.proofBoundary !== "CONFIGURATION_BLOCKED" || step.detail.length > 20)).toBe(true);
    }
  });
});
