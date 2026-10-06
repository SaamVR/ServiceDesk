import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/server/core/request-photo-retention.ts"),
  "utf8",
);

describe("request photo retention worker", () => {
  it("scans only bounded due/retired/opted-out assets in one workspace", () => {
    expect(source).toContain('.eq("workspace_id", input.workspaceId)');
    expect(source).toContain('.in("state", ["AVAILABLE", "RETIRED"])');
    expect(source).toContain("retention_until.lte.");
    expect(source).toContain("processing_opt_out.eq.true");
    expect(source).toContain("Math.max(1, Math.min(input.limit ?? 50, 100))");
  });

  it("claims retirement before touching storage and marks deleted only after storage removal", () => {
    const claim = source.indexOf('"servicedesk_claim_request_photo_for_deletion"');
    const remove = source.indexOf(".remove([storage.objectPath])");
    const mark = source.indexOf('"servicedesk_mark_request_photo_deleted"');
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(remove).toBeGreaterThan(claim);
    expect(mark).toBeGreaterThan(remove);
  });

  it("leaves failed storage deletions retired for retry instead of pretending deletion succeeded", () => {
    expect(source).toContain("if (removed.error)");
    expect(source).toContain("outcome.retiredForRetry += 1");
    expect(source).not.toContain("throw removed.error");
  });

  it("returns aggregate counters only and never returns storage refs", () => {
    expect(source).toContain("RequestPhotoRetentionRun");
    expect(source).toContain("scanned:");
    expect(source).toContain("deleted:");
    expect(source).toContain("retiredForRetry:");
    expect(source).toContain("skipped:");
    expect(source).not.toContain("storageRefs:");
  });
});
