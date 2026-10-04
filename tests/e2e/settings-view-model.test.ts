import { describe, expect, it } from "vitest";
import { sampleIntegrations } from "../../src/features/operations/sample-data";
import {
  buildOwnerSettingsView,
  type ServiceSettingFixture,
  type TeamInviteFixture,
} from "../../src/features/settings/view-models";

const services: ServiceSettingFixture[] = [
  { code: "MOVE_OUT", label: "Move-out clean", enabled: true, rateVersion: "move-out-v1" },
  { code: "DEEP", label: "Deep clean", enabled: false, rateVersion: "deep-draft" },
];

const invites: TeamInviteFixture[] = [
  { id: "invite_dispatcher_1", role: "DISPATCHER", state: "PENDING", label: "Dispatcher invite" },
  { id: "invite_crew_1", role: "CREW", state: "ACCEPTED", label: "Crew member" },
];

describe("owner settings UI model", () => {
  it("shows services and team invite state without exposing secrets", () => {
    const view = buildOwnerSettingsView({
      services,
      invites,
      integrations: sampleIntegrations,
    });

    expect(view.services).toHaveLength(2);
    expect(view.team).toHaveLength(2);
    expect(view.exposesSecrets).toBe(false);
  });

  it("keeps readiness blocked while required integrations are fixture or degraded", () => {
    const view = buildOwnerSettingsView({
      services,
      invites,
      integrations: sampleIntegrations,
    });

    expect(view.releaseLabel).toBe("CONFIGURATION_BLOCKED");
    expect(view.integrationHealth.some((item) => item.ready === false)).toBe(true);
  });

  it("labels fixture-owned settings until shared catalog/member DTOs exist", () => {
    const view = buildOwnerSettingsView({
      services,
      invites,
      integrations: sampleIntegrations,
    });

    expect(view.dataSource).toBe("FIXTURE_UI_ONLY");
  });
});
