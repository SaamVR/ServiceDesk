import { describe, expect, it } from "vitest";
import { staffModuleConfig } from "../../src/features/operations/staff-modules";

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
});
