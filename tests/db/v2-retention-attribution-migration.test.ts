import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0051_v2_retention_attribution.sql"),
  "utf8",
);

describe("V2 retention attribution migration", () => {
  it("stores append-only touch and paid-job conversion events", () => {
    expect(sql).toContain("create table if not exists public.lead_attribution_events");
    expect(sql).toContain("event_kind in ('TOUCH','PAID_JOB')");
    expect(sql).toContain("unique (workspace_id, idempotency_key)");
    expect(sql).toContain("first_touch_event_id");
    expect(sql).toContain("last_touch_event_id");
  });

  it("freezes first/last touch exactly when an invoice first becomes paid", () => {
    expect(sql).toContain("after update of status on public.invoices");
    expect(sql).toContain("if new.status <> 'PAID' or old.status = 'PAID' then");
    expect(sql).toContain("order by e.occurred_at asc");
    expect(sql).toContain("order by e.occurred_at desc");
    expect(sql).toContain("'paid-job:' || new.id::text");
    expect(sql).toContain("on conflict (workspace_id, idempotency_key) do nothing");
  });

  it("requires an active referral code for referral touches", () => {
    expect(sql).toContain("v_source_type = 'REFERRAL'");
    expect(sql).toContain("REFERRAL_CODE_REQUIRED");
    expect(sql).toContain("REFERRAL_CODE_INACTIVE");
    expect(sql).toContain("(starts_at is null or starts_at <= v_occurred)");
    expect(sql).toContain("(ends_at is null or ends_at > v_occurred)");
  });

  it("reports referral-to-paid-job counts from stored events with a non-perfect-attribution disclosure", () => {
    expect(sql).toContain("servicedesk_read_referral_attribution_summary");
    expect(sql).toContain("'paidJobCount'");
    expect(sql).toContain("p.first_touch_event_id");
    expect(sql).toContain("p.last_touch_event_id");
    expect(sql).toContain("Attribution is directional, not perfect.");
  });

  it("keeps direct mutation service-role-only while staff reads are RLS-scoped", () => {
    expect(sql).toContain("grant select on table public.referral_codes to authenticated");
    expect(sql).toContain("grant select on table public.lead_attribution_events to authenticated");
    expect(sql).toContain("grant select, insert, update, delete on table public.referral_codes to service_role");
    expect(sql).toContain("grant select, insert, update, delete on table public.lead_attribution_events to service_role");
    expect(sql).toContain("servicedesk_require_staff");
    expect(sql).toContain("revoke all on function public.servicedesk_upsert_referral_code(jsonb) from public, anon, authenticated");
    expect(sql).toContain("revoke all on function public.servicedesk_record_attribution_touch(jsonb) from public, anon, authenticated");
  });
});
