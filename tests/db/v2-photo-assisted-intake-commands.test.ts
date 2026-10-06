import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0049_v2_photo_assisted_intake_commands.sql"),
  "utf8",
);

describe("V2 photo-assisted intake commands", () => {
  it("requires granted consent and rejects any training authorization", () => {
    expect(sql).toContain("PHOTO_CONSENT_REQUIRED");
    expect(sql).toContain("PHOTO_TRAINING_FORBIDDEN");
    expect(sql).toContain("training_allowed, retention_until");
    expect(sql).toContain("false, v_retention_until");
  });

  it("allows suggestion recording only while the source asset is processable", () => {
    expect(sql).toContain("v_asset.state <> 'AVAILABLE'");
    expect(sql).toContain("v_asset.consent_status <> 'GRANTED'");
    expect(sql).toContain("v_asset.processing_opt_out");
    expect(sql).toContain("v_asset.retention_until <= v_now");
    expect(sql).toContain("PHOTO_PROCESSING_NOT_ALLOWED");
  });

  it("records AI suggestions idempotently and bounds follow-up questions", () => {
    expect(sql).toContain("idempotency_key = v_idempotency");
    expect(sql).toContain("jsonb_array_length(v_questions) > 5");
    expect(sql).toContain("length(trim(q #>> '{}')) > 200");
  });

  it("makes human accept/reject review explicit and detects accepted quotes", () => {
    expect(sql).toContain("v_decision not in ('ACCEPTED','REJECTED')");
    expect(sql).toContain("q.status = 'ACCEPTED'");
    expect(sql).toContain("'quoteRevisionRequired'");
    expect(sql).toContain("servicedesk_require_staff");
  });

  it("never mutates request pricing or quote business truth during review", () => {
    const reviewStart = sql.indexOf("create or replace function public.servicedesk_review_request_photo_suggestion");
    const reviewEnd = sql.indexOf("create or replace function public.servicedesk_opt_out_request_photo_processing", reviewStart);
    const review = sql.slice(reviewStart, reviewEnd);
    expect(review).toContain("update public.request_photo_suggestions");
    expect(review).not.toContain("update public.quotes");
    expect(review).not.toContain("update public.quote_items");
    expect(review).not.toContain("update public.requests");
    expect(review).not.toContain("subtotal_minor");
    expect(review).not.toContain("total_minor");
  });

  it("retires opted-out assets and expires only pending suggestions", () => {
    expect(sql).toContain("processing_opt_out = true");
    expect(sql).toContain("state = 'RETIRED'");
    expect(sql).toContain("state = 'EXPIRED'");
    expect(sql).toContain("and state = 'PENDING_REVIEW'");
  });

  it("keeps every mutation service-role-only", () => {
    for (const fn of [
      "servicedesk_register_request_photo_asset",
      "servicedesk_record_request_photo_suggestion",
      "servicedesk_review_request_photo_suggestion",
      "servicedesk_opt_out_request_photo_processing",
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}(jsonb) from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${fn}(jsonb) to service_role`);
    }
  });
});
