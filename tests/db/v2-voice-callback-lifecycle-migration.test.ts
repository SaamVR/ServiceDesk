import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0045_v2_voice_callback_lifecycle.sql"),
  "utf8",
);

describe("V2 missed-call callback lifecycle migration", () => {
  it("adds explicit callback resolution state without caller identity fields", () => {
    expect(sql).toContain("add column if not exists version bigint");
    expect(sql).toContain("add column if not exists resolved_at timestamptz");
    expect(sql).toContain("add column if not exists resolved_by_user_id uuid");
    expect(sql).toContain("voice_call_intakes_resolution_state_ck");
  });

  it("restricts callback changes to owner or dispatcher staff", () => {
    expect(sql).toContain("v_actor_role not in ('OWNER','DISPATCHER')");
    expect(sql).toContain("servicedesk_require_staff");
    expect(sql).toContain("FORBIDDEN");
  });

  it("is idempotent when the requested callback state is already current", () => {
    expect(sql).toContain("if v_intake.callback_state = v_state then");
    expect(sql).toContain("'duplicate', true");
  });

  it("synchronizes request callback metadata and attention state", () => {
    expect(sql).toContain("'callbackRequired', v_state = 'PENDING'");
    expect(sql).toContain("'callbackState', v_state");
    expect(sql).toContain("type = 'VOICE_CALLBACK'");
    expect(sql).toContain("status = 'RESOLVED'");
    expect(sql).toContain("'WARNING', 'OPEN', 'Missed call requires staff callback.'");
  });

  it("audits state/version without caller PII", () => {
    const auditStart = sql.indexOf("insert into public.audit_events");
    const auditEnd = sql.indexOf("return jsonb_build_object", auditStart);
    const audit = sql.slice(auditStart, auditEnd);
    expect(audit).toContain("VOICE_CALLBACK_RESOLVED");
    expect(audit).toContain("VOICE_CALLBACK_REOPENED");
    expect(audit).not.toContain("caller");
    expect(audit).not.toContain("callbackContactRef");
  });

  it("keeps the command service-role-only", () => {
    expect(sql).toContain("revoke all on function public.servicedesk_set_voice_callback_state(jsonb) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_set_voice_callback_state(jsonb) to service_role");
  });
});
