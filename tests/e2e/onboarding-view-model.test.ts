import { describe, expect, it } from "vitest";
import {
  buildOnboardingReadinessView,
  buildOnboardingSetupView,
} from "../../src/features/onboarding/view-models";
import { sampleIntegrations } from "../../src/features/operations/sample-data";

describe("onboarding readiness view model", () => {
  it("marks provider setup as blocked until integrations are verified", () => {
    const view = buildOnboardingReadinessView(sampleIntegrations);

    expect(view.overallState).toBe("CONFIGURATION_BLOCKED");
    expect(view.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: "GOOGLE_CALENDAR", label: "Google Calendar", stateLabel: "Degraded fixture" }),
      expect.objectContaining({ provider: "WHATSAPP", label: "WhatsApp", stateLabel: "Not configured fixture" }),
    ]));
    expect(view.releaseNote).toContain("Provider receipts are still required");
  });

  it("does not treat fixture or sandbox mode as production-ready", () => {
    const view = buildOnboardingReadinessView([
      { workspaceId: "ws", provider: "PAYMENT", status: "CONNECTED", mode: "SANDBOX", message: "Sandbox configured" },
      { workspaceId: "ws", provider: "AI", status: "CONNECTED", mode: "FIXTURE", message: "Fixture assistant" },
    ]);

    expect(view.overallState).toBe("CONFIGURATION_BLOCKED");
    expect(view.items.every((item) => item.canClaimLive === false)).toBe(true);
  });

  it("keeps setup steps ordered and blocks launch when providers are not live", () => {
    const view = buildOnboardingSetupView(sampleIntegrations);

    expect(view.steps.map((step) => step.key)).toEqual([
      "business",
      "services",
      "team",
      "policies",
      "integrations",
      "readiness",
    ]);
    expect(view.readyToLaunch).toBe(false);
    expect(view.steps.find((step) => step.key === "integrations")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(view.launchLabel).toBe("Launch blocked by provider configuration");
  });
});
