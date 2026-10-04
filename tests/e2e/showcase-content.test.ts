import { describe, expect, it } from "vitest";
import {
  moveOutFixture,
  presentationSlides,
  productRoutes,
  tourScenarios,
  uiDesignTokens,
  uiStateScenarios,
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

  it("ties every tour scenario to implemented product routes", () => {
    for (const scenario of tourScenarios) {
      expect(scenario.routeLinks.length).toBeGreaterThanOrEqual(3);
      expect(scenario.routeLinks.every((link) => link.href.startsWith("/"))).toBe(true);
      expect(scenario.steps.every((step) => step.routeHref.startsWith("/"))).toBe(true);
    }

    expect(tourScenarios[0].routeLinks.map((link) => link.href)).toEqual([
      "/b/brightroom/enquire",
      "/portal/quotes/quote_moveout_001",
      "/portal/bookings/visit_showcase_001",
      "/crew/jobs/visit_showcase_001",
      "/portal/invoices/invoice_showcase_001",
    ]);
  });

  it("keeps tour scenarios free from forbidden provider-proof claims", () => {
    const forbidden = ["PROVIDER_VERIFIED", "live receipt", "delivered proof", "production payment"];
    const scenarioText = JSON.stringify(tourScenarios).toLowerCase();

    for (const phrase of forbidden) {
      expect(scenarioText).not.toContain(phrase.toLowerCase());
    }
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

  it("provides reusable loading, empty and error state scenarios for route shells", () => {
    expect(uiStateScenarios.map((scenario) => scenario.state)).toEqual(["loading", "empty", "error"]);
    expect(uiStateScenarios.every((scenario) => scenario.ariaLive === "polite" || scenario.ariaLive === "assertive")).toBe(true);
    expect(uiStateScenarios.find((scenario) => scenario.state === "error")?.tone).toBe("failure");
  });
});
