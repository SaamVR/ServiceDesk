import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);

describe("V2 multi-branch operational runtime", () => {
  it("falls back safely when branch tables are not migrated yet", () => {
    expect(runtime).toContain('branchRead.error?.code === "42P01"');
    expect(runtime).toContain('value: { mode: "LEGACY", branches: [] }');
    expect(runtime).toContain("Branch controls are not available in this environment yet.");
  });

  it("allows HQ/all scope only for owners and requires dispatcher assignments", () => {
    expect(runtime).toContain('if (input.role === "OWNER")');
    expect(runtime).toContain('value: { mode: "ALL", branches: allBranches }');
    expect(runtime).toContain('.from("branch_memberships")');
    expect(runtime).toContain('.eq("status", "ACTIVE")');
    expect(runtime).toContain("Your dispatcher account has no active branch assignment.");
    expect(runtime).toContain('if (actor.role !== "OWNER")');
    expect(runtime).toContain("Only an owner can open the company-wide branch view.");
  });

  it("filters branch-sensitive rows before mapping property access notes", () => {
    const branchFilter = runtime.indexOf("const propertyRows = rawPropertyRows.filter(inSelectedBranch)");
    const propertyMap = runtime.indexOf("const properties: OperationalProperty[] = propertyRows.map");
    const accessNotes = runtime.indexOf('accessNotes: textValue(row, "access_notes")', propertyMap);
    expect(branchFilter).toBeGreaterThanOrEqual(0);
    expect(propertyMap).toBeGreaterThan(branchFilter);
    expect(accessNotes).toBeGreaterThan(propertyMap);
    expect(runtime).not.toContain("rawPropertyRows.map");
  });

  it("filters dependent quote, invoice, message, photo and quality data through branch-scoped parent ids", () => {
    expect(runtime).toContain("requestIds.has(String(row.request_id))");
    expect(runtime).toContain("visitIds.has(String(row.visit_id))");
    expect(runtime).toContain("conversationIds.has(String(row.conversation_id))");
    expect(runtime).toContain("capacityIds.has(String(row.slot_id))");
    expect(runtime).toContain("qualityIds.has(id)");
    expect(runtime).toContain("photoAssetRows");
    expect(runtime).toContain("!branchId || requestIds.has(String(row.request_id))");
  });

  it("fails closed for unknown attention resource types in branch mode", () => {
    expect(runtime).toContain('if (type === "conversation") return conversationIds.has(id)');
    expect(runtime).toContain('if (type === "quality" || type === "quality_case") return qualityIds.has(id)');
    expect(runtime).toContain("return false;");
  });

  it("withholds workspace-wide reporting and growth aggregates in branch mode", () => {
    expect(runtime).toContain("reporting: !branchId && reportingResult.ok");
    expect(runtime).toContain("if (!branchId && !attributionRead.error");
    expect(runtime).toContain("const retentionCampaigns: OperationalRetentionCampaign[] = (branchId ? [] : campaignRows)");
  });

  it("uses branch-native timezone for branch-scoped rendering", () => {
    expect(runtime).toContain("workspace: selectedBranch ? { ...workspace, timezone: selectedBranch.timezone } : workspace");
  });

  it("guards every major branch-sensitive server action before authoritative RPC execution", () => {
    expect(runtime).toContain("requireOperationalBranchResource");
    for (const kind of [
      '"conversation"',
      '"quote"',
      '"invoice"',
      '"quality"',
      '"request"',
      '"capacity"',
      '"visit"',
      '"crew"',
      '"recurrence"',
      '"voiceIntake"',
      '"photoSuggestion"',
      '"customer"',
    ]) {
      expect(runtime).toContain(`requireOperationalBranchResource(resolved.value, ${kind}`);
    }
    expect(runtime).toContain("This record is not available in your selected branch.");
  });
});
