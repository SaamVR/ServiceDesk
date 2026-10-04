import { describe, expect, it } from "vitest";
import {
  buildStaffModuleHref,
  staffModuleConfig,
  staffNavigationGroups,
} from "../../src/features/operations/staff-modules";

describe("staff route module map", () => {
  it("keeps each V1 staff route tied to one primary operational module", () => {
    expect(Object.keys(staffModuleConfig)).toEqual([
      "overview",
      "inbox",
      "customers",
      "requests",
      "quotes",
      "schedule",
      "jobs",
      "invoices",
      "quality",
      "automations",
      "reports",
      "settings",
      "billing",
    ]);
  });

  it("keeps secondary operations modules distinct from core navigation", () => {
    expect(staffModuleConfig.quality.group).toBe("operations");
    expect(staffModuleConfig.automations.group).toBe("operations");
    expect(staffModuleConfig.reports.group).toBe("operations");
    expect(staffModuleConfig.settings.group).toBe("settings");
    expect(staffModuleConfig.billing.group).toBe("settings");
  });

  it("exposes every staff module in explicit navigation groups", () => {
    expect(staffNavigationGroups.map((group) => group.label)).toEqual([
      "Core",
      "Operations",
      "Settings",
    ]);

    expect(staffNavigationGroups.flatMap((group) => group.modules)).toEqual([
      "overview",
      "inbox",
      "customers",
      "requests",
      "quotes",
      "schedule",
      "jobs",
      "invoices",
      "quality",
      "automations",
      "reports",
      "settings",
      "billing",
    ]);
  });

  it("builds stable staff hrefs from the workspace slug", () => {
    expect(buildStaffModuleHref("brightroom", "quotes")).toBe("/app/brightroom/quotes");
    expect(buildStaffModuleHref("Bright Room", "schedule")).toBe("/app/Bright%20Room/schedule");
  });

  it("does not fall back dedicated routes to the generic overview surface", () => {
    expect(staffModuleConfig.quality.primarySurface).toBe("quality-review");
    expect(staffModuleConfig.automations.primarySurface).toBe("recovery-actions");
    expect(staffModuleConfig.settings.primarySurface).toBe("owner-settings");
    expect(staffModuleConfig.billing.primarySurface).toBe("platform-billing");
  });
});
