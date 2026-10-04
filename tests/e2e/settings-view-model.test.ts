import { describe, expect, it } from "vitest";
import type { OwnerSettingsSnapshotDTO } from "../../src/contracts";
import { sampleIntegrations } from "../../src/features/operations/sample-data";
import { buildOwnerSettingsView } from "../../src/features/settings/view-models";

const snapshot: OwnerSettingsSnapshotDTO = {
  workspaceId: "ws_showcase",
  services: [
    { code: "MOVE_OUT", label: "Move-out clean", enabled: true },
    { code: "DEEP", label: "Deep clean", enabled: false },
  ],
  members: [{ userId: "owner_1", role: "OWNER", active: true }],
  invitations: [{ id: "invite_dispatcher_1", role: "DISPATCHER", state: "PENDING", createdAt: "2026-10-04T06:00:00.000Z" }],
};

describe("owner settings UI model", () => {
  it("shows services and team state without exposing secrets", () => {
    const view = buildOwnerSettingsView({ snapshot, integrations: sampleIntegrations, sourceLabel: "FIXTURE_UI_ONLY" });
    expect(view.services).toHaveLength(2);
    expect(view.team).toHaveLength(2);
    expect(view.exposesSecrets).toBe(false);
  });
  it("keeps readiness blocked while required integrations are fixture or degraded", () => {
    const view = buildOwnerSettingsView({ snapshot, integrations: sampleIntegrations });
    expect(view.releaseLabel).toBe("CONFIGURATION_BLOCKED");
    expect(view.integrationHealth.some((item) => item.ready === false)).toBe(true);
  });
  it("preserves explicit fixture ownership for fixture settings", () => {
    const view = buildOwnerSettingsView({ snapshot, integrations: sampleIntegrations, sourceLabel: "FIXTURE_UI_ONLY" });
    expect(view.dataSource).toBe("FIXTURE_UI_ONLY");
  });
});
