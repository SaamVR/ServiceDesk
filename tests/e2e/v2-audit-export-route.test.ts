import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/app/api/governance/audit-export/route.ts"),
  "utf8",
);

describe("V2 governance audit export route", () => {
  it("requires an authenticated Owner and the authoritative metadata RPC", () => {
    expect(route).toContain("resolveStaffActor(workspaceSlug)");
    expect(route).toContain('resolved.value.actor.role !== "OWNER"');
    expect(route).toContain('"servicedesk_read_audit_export_metadata"');
  });

  it("bounds the export to 1-31 days and 5000 rows", () => {
    expect(route).toContain("daysRaw >= 1 && daysRaw <= 31");
    expect(route).toContain("limit: 5000");
  });

  it("exports only metadata columns and never audit before/after payloads", () => {
    expect(route).toContain('"actor_role"');
    expect(route).toContain('"resource_type"');
    expect(route).toContain('"created_at"');
    expect(route).not.toContain("before_data");
    expect(route).not.toContain("after_data");
    expect(route).not.toContain("beforeData");
    expect(route).not.toContain("afterData");
  });

  it("uses private no-store CSV responses", () => {
    expect(route).toContain('"text/csv; charset=utf-8"');
    expect(route).toContain('"servicedesk-audit-metadata.csv"');
    expect(route).toContain('"cache-control": "private, no-store, max-age=0"');
    expect(route).toContain('"x-content-type-options": "nosniff"');
  });

  it("neutralizes spreadsheet-formula prefixes in exported metadata", () => {
    expect(route).toContain("/^[=+\\-@\\t\\r]/");
    expect(route).toContain("\"'\" + raw");
  });

  it("surfaces server-side truncation without exporting before/after payloads", () => {
    expect(route).toContain('"x-servicedesk-export-truncated"');
    expect(route).toContain('data.truncated === true ? "true" : "false"');
    expect(route).not.toContain("before_data");
    expect(route).not.toContain("after_data");
  });

});
