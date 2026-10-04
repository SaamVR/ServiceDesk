import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("V1 INT6 durable Postgres RPC source", () => {
  it("defines E03 verified payment as service-role-only SECURITY INVOKER source", () => {
    const sql = read("supabase/migrations/0010_e03_verified_payment_rpc.sql");
    expect(sql).toContain("create or replace function public.servicedesk_apply_verified_payment");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("revoke all on function public.servicedesk_apply_verified_payment(jsonb) from anon");
    expect(sql).toContain("revoke all on function public.servicedesk_apply_verified_payment(jsonb) from authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_apply_verified_payment(jsonb) to service_role");
    expect(sql).toContain("calendar.visit.upsert");
    expect(sql).toContain("PLATFORM_SUBSCRIPTION_OUT_OF_SCOPE");
  });

  it("defines E06 field runtime tables and service-role-only RPCs", () => {
    const sql = read("supabase/migrations/0011_visit_field_runtime.sql");
    expect(sql).toContain("create table if not exists public.visit_evidence");
    expect(sql).toContain("create table if not exists public.visit_checklist_items");
    expect(sql).toContain("create or replace function public.servicedesk_transition_visit");
    expect(sql).toContain("create or replace function public.servicedesk_add_visit_evidence");
    expect(sql).toContain("create or replace function public.servicedesk_set_visit_checklist_item");
    expect(sql).toContain("VISIT_REVIEW_EVIDENCE_REQUIRED");
    expect(sql).toContain("FIELD_INCIDENT");
    expect(sql).toContain("calendar.visit.cancel");
    expect(sql).toContain("grant execute on function public.servicedesk_transition_visit(jsonb) to service_role");
  });

  it("maps DB visit statuses into facade DTO statuses instead of unsafe enum casting", () => {
    const paymentAdapter = read("src/server/core/payment-application-postgres.ts");
    const visitAdapter = read("src/server/core/visit-field-postgres.ts");
    expect(paymentAdapter).toContain('SCHEDULED: "CONFIRMED"');
    expect(paymentAdapter).toContain('NEEDS_REVIEW: "PENDING_REVIEW"');
    expect(paymentAdapter).toContain("PAYMENT_RPC_MALFORMED");
    expect(visitAdapter).toContain('SCHEDULED: "CONFIRMED"');
    expect(visitAdapter).toContain('NEEDS_REVIEW: "PENDING_REVIEW"');
    expect(visitAdapter).toContain("VISIT_TRANSITION_RPC_ERROR");
  });
});
