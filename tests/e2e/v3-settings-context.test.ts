import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { settingsFeedbackFragment, settingsSections } from "../../src/features/operations/settings-navigation";

describe("Workroom settings mutation navigation", () => {
  it("returns staff to the section where a real server command was made", () => {
    for (const section of settingsSections) {
      expect(settingsFeedbackFragment("settings", "section=" + section + "&")).toBe("#" + section);
    }
    expect(settingsFeedbackFragment("requests", "section=branches&")).toBe("");
    expect(settingsFeedbackFragment("settings", "section=%2e%2e%2fadmin&")).toBe("");
    expect(settingsFeedbackFragment("settings", "section=other&")).toBe("");
  });
  it("preserves server-action redirects and anchors to actual setting panels", () => {
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.module.css"), "utf8");
    expect(route).toContain("settingsFeedbackFragment(module, extra)");
    for (const section of settingsSections) {
      expect(route).toContain('id="' + section + '"');
    }
    expect(css).toContain(".settingsCard:target");
  });
});
