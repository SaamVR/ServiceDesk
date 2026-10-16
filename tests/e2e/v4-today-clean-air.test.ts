import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const get = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V4 Today: visual-only Clean Air operational workroom refinement", () => {
  const original = get("src/features/operations/StaffOverviewDashboard.tsx");
  const allStyles = get("src/features/operations/StaffOverviewDashboard.module.css");
  const skin = allStyles.split("/* V4 / CLEAN AIR — real Today workroom.")[1] ?? "";

  it("uses accepted porcelain/sea-glass style on the actual Today dashboard", () => {
    expect(skin.length).toBeGreaterThan(4300);
    for (const requirement of [
      ".dashboard {",
      ".pageHeader h1 {",
      ".workdayBrief {",
      "background: linear-gradient(105deg, #e1f6ed",
      ".briefingLabel { color: #238778",
      ".kpiCard {",
      ".kpi_warning { border-left: 3px",
      ".kpi_danger { border-left: 3px",
      ".card {",
      ".attentionCard { border-top: 3px",
      ".quickActions a {",
      "min-height: 44px",
      "font-family: \"Manrope\"",
      "font-family: \"DM Sans\"",
      "@media (max-width: 700px)",
      "@media (max-width: 470px)",
      "@media (prefers-reduced-motion: reduce)",
    ]) expect(skin).toContain(requirement);
    expect(skin).not.toContain("linear-gradient(108deg,#1e414c");
    expect(skin).not.toContain("fonts.googleapis.com");
  });

  it("keeps real decision-first cards linked to actual operational records and their permissions", () => {
    expect(original).toContain("OperationalStaffSnapshot");
    expect(original).toContain("summarizeVerifiedOutstandingInvoices");
    expect(original).toContain("buildQuotePipeline");
    expect(original).toContain("prioritizeQualityFollowUp");
    expect(original).toContain("attentionResourceHref");
    expect(original).toContain("buildStaffModuleHref");
    expect(original).toContain("href={href}");
    expect(original).not.toContain("style={{");
    const staffShell = get("src/components/product/StaffAppShell.tsx");
    expect(staffShell).toContain("StaffCleanAirV4.module.css");
    expect(staffShell).toContain("StaffNavigation");
  });

  it("does not visually erase serious or overdue work in favor of decorative status", () => {
    expect(skin).toContain(".kpi_warning strong { color: #885e26; }");
    expect(skin).toContain(".kpi_danger strong { color: #b3424c; }");
    expect(skin).toContain("border-left: 3px solid #c75a61");
    expect(allStyles).toContain(".severity_critical");
    expect(original).toContain("CRITICAL");
    expect(original).toContain("WARNING");
  });

  it("enforces accessible mobile tap targets and removes unnecessary motion", () => {
    expect(skin).toContain(".headerActions a {");
    expect(skin).toContain(".textLink {");
    expect(skin).toContain(".quickActions a {");
    expect(skin).toContain("min-height: 44px");
    expect(skin).toContain(".workdayBrief a:focus-visible");
    expect(skin).toContain("outline-offset: 4px");
    expect(skin).toContain("transition: none !important");
  });
});
