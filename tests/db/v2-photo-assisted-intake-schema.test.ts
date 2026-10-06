import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0048_v2_photo_assisted_intake_schema.sql"),
  "utf8",
);

describe("V2 photo-assisted intake schema", () => {
  it("keeps customer photo assets separate from quote and request pricing truth", () => {
    expect(sql).toContain("create table if not exists public.request_photo_assets");
    expect(sql).toContain("create table if not exists public.request_photo_suggestions");
    expect(sql).toContain("foreign key (workspace_id, request_id)");
    expect(sql).not.toMatch(/alter table public\.quotes/i);
    expect(sql).not.toMatch(/alter table public\.quote_items/i);
  });

  it("requires opaque bounded image references and supported image types", () => {
    expect(sql).toContain("storage_ref !~* '^(https?://|data:)'");
    expect(sql).toContain("'image/jpeg','image/png','image/webp'");
    expect(sql).toContain("byte_size between 1 and 20971520");
  });

  it("stores explicit consent, opt-out, retention and permanently disables training", () => {
    expect(sql).toContain("consent_status");
    expect(sql).toContain("processing_opt_out");
    expect(sql).toContain("retention_until");
    expect(sql).toContain("training_allowed boolean not null default false check (training_allowed = false)");
  });

  it("makes AI confidence/source and human review state explicit", () => {
    expect(sql).toContain("photo_asset_id uuid not null");
    expect(sql).toContain("classifier_ref text not null");
    expect(sql).toContain("confidence_basis_points integer not null");
    expect(sql).toContain("'PENDING_REVIEW','ACCEPTED','REJECTED','EXPIRED'");
    expect(sql).toContain("reviewed_by uuid");
  });

  it("allows authenticated staff reads but no direct authenticated mutation policy", () => {
    expect(sql).toContain("request_photo_assets_staff_select");
    expect(sql).toContain("request_photo_suggestions_staff_select");
    expect(sql).not.toMatch(/for all to authenticated/);
    expect(sql).not.toMatch(/for insert to authenticated/);
    expect(sql).not.toMatch(/for update to authenticated/);
  });
});
