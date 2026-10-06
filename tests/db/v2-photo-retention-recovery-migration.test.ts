import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0050_v2_photo_retention_recovery.sql"),
  "utf8",
);

describe("V2 request photo retention recovery", () => {
  it("audits photo registration/state changes without persisting storage references", () => {
    expect(sql).toContain("REQUEST_PHOTO_ASSET_REGISTERED");
    expect(sql).toContain("REQUEST_PHOTO_ASSET_STATE_CHANGED");
    const triggerSection = sql.slice(
      sql.indexOf("servicedesk_audit_request_photo_asset_state"),
      sql.indexOf("servicedesk_claim_request_photo_for_deletion"),
    );
    expect(triggerSection).not.toContain("'storageRef'");
    expect(triggerSection).not.toContain("storage_ref");
  });

  it("retires expired or opted-out photos before returning a deletion reference", () => {
    expect(sql).toContain("servicedesk_claim_request_photo_for_deletion");
    expect(sql).toContain("v_asset.retention_until > v_now and not v_asset.processing_opt_out");
    expect(sql).toContain("state = 'RETIRED'");
    expect(sql).toContain("processing_opt_out = true");
    expect(sql).toContain("'storageRef', v_asset.storage_ref");
  });

  it("expires only pending AI suggestions during the retention claim", () => {
    expect(sql).toContain("update public.request_photo_suggestions");
    expect(sql).toContain("set state = 'EXPIRED'");
    expect(sql).toContain("and state = 'PENDING_REVIEW'");
  });

  it("tombstones the database storage reference only after the separate delete-confirmation command", () => {
    const mark = sql.slice(sql.indexOf("servicedesk_mark_request_photo_deleted"));
    expect(mark).toContain("v_asset.state <> 'RETIRED'");
    expect(mark).toContain("storage_ref = 'deleted:' || id::text");
    expect(mark).toContain("state = 'DELETED'");
  });

  it("keeps retention commands service-role-only", () => {
    for (const fn of [
      "servicedesk_claim_request_photo_for_deletion",
      "servicedesk_mark_request_photo_deleted",
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}(jsonb) from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${fn}(jsonb) to service_role`);
    }
  });
});
