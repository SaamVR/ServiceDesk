import { describe, expect, it } from "vitest";
import type { OwnerSettingsSnapshotDTO } from "../../src/contracts";
import { buildOnboardingReadinessView, buildOnboardingSetupView } from "../../src/features/onboarding/view-models";
import { sampleIntegrations } from "../../src/features/operations/sample-data";

const settings: OwnerSettingsSnapshotDTO = {
  workspaceId: "ws_showcase",
  services: [{ code: "MOVE_OUT", label: "Move-out clean", enabled: true }],
  members: [{ userId: "owner_1", role: "OWNER", active: true }],
  invitations: [],
};

describe("onboarding readiness view model", () => {
  it("marks provider setup as blocked until integrations are live", () => {
    const view = buildOnboardingReadinessView({ settings, integrations: sampleIntegrations });
    expect(view.overallState).toBe("CONFIGURATION_BLOCKED");
    expect(view.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: "GOOGLE_CALENDAR", label: "Google Calendar", canClaimLive: false }),
      expect.objectContaining({ provider: "WHATSAPP", label: "WhatsApp", canClaimLive: false }),
    ]));
    expect(view.releaseNote).toContain("not live readiness");
  });

  it("does not treat fixture or sandbox mode as production-ready", () => {
    const view = buildOnboardingReadinessView({
      settings,
      integrations: [
        { workspaceId: "ws", provider: "PAYMENT", status: "CONNECTED", mode: "SANDBOX", message: "Sandbox configured" },
        { workspaceId: "ws", provider: "AI", status: "CONNECTED", mode: "FIXTURE", message: "Fixture assistant" },
      ],
    });
    expect(view.overallState).toBe("CONFIGURATION_BLOCKED");
    expect(view.items.every((item) => item.canClaimLive === false)).toBe(true);
  });

  it("keeps setup steps ordered and blocks launch when providers are not live", () => {
    const view = buildOnboardingSetupView({ settings, integrations: sampleIntegrations });
    expect(view.steps.map((step) => step.key)).toEqual(["business", "services", "team", "integrations", "readiness"]);
    expect(view.readyToLaunch).toBe(false);
    expect(view.steps.find((step) => step.key === "integrations")?.state).toBe("CONFIGURATION_BLOCKED");
    expect(view.launchLabel).toBe("Launch blocked by configuration or owner input");
  });
});
