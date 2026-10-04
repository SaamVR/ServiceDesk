import { describe, expect, it } from "vitest";
import {
  moveOutFixture,
  presentationSlides,
  productRoutes,
  tourScenarios,
  uiDesignTokens,
} from "../../src/features/product/story-model";

describe("ServiceDesk product showcase content contract", () => {
  it("covers every required public product route without claiming provider proof", () => {
    expect(productRoutes.map((route) => route.href)).toEqual([
      "/",
      "/features",
      "/integrations",
      "/use-cases/cleaning",
      "/pricing",
      "/help",
      "/contact",
      "/privacy",
      "/terms",
    ]);

    expect(productRoutes.every((route) => route.claimLevel === "IMPLEMENTED_UI" || route.claimLevel === "CONFIGURATION_BLOCKED")).toBe(true);
  });

  it("keeps the frozen move-out pricing fixture exact", () => {
    expect(moveOutFixture.totalMinor).toBe(34_000);
    expect(moveOutFixture.depositMinor).toBe(8_500);
    expect(moveOutFixture.balanceMinor).toBe(25_500);
    expect(moveOutFixture.serviceMinutes).toBe(240);
    expect(moveOutFixture.bufferMinutes).toBe(30);
  });

  it("defines three controlled tour scenarios and labels synthetic provider history", () => {
    expect(tourScenarios).toHaveLength(3);
    expect(tourScenarios.map((scenario) => scenario.id)).toEqual([
      "enquiry-to-paid-job",
      "unusual-work-approval",
      "failed-send-recovery",
    ]);
    expect(tourScenarios.every((scenario) => scenario.providerEvidence === "SYNTHETIC_UNTIL_CHAT_2_VERIFIED")).toBe(true);
  });

  it("defines ten accessible presentation slides that deep-link to tour steps", () => {
    expect(presentationSlides).toHaveLength(10);
    expect(presentationSlides.every((slide) => slide.tourHref.startsWith("/tour#"))).toBe(true);
    expect(presentationSlides.map((slide) => slide.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("uses the approved visual tokens", () => {
    expect(uiDesignTokens.page).toBe("#F6F7F7");
    expect(uiDesignTokens.section).toBe("#EEF0F0");
    expect(uiDesignTokens.surface).toBe("#FFFFFF");
    expect(uiDesignTokens.text).toBe("#17211D");
    expect(uiDesignTokens.action).toBe("#14634A");
  });
});
