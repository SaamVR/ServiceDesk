import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0046_v2_conversation_verified_identity_resolution.sql"),
  "utf8",
);

describe("V2 verified conversation identity resolution", () => {
  it("derives identity from persisted inbound sender data instead of operator customer input", () => {
    expect(sql).toContain("from public.messages m");
    expect(sql).toContain("m.direction = 'INBOUND'");
    expect(sql).toContain("m.sender_ref");
    expect(sql).not.toMatch(/p_input->>'customerId'/);
  });

  it("requires exact channel-specific verified active contact matching", () => {
    expect(sql).toContain("cc.verified_at is not null");
    expect(sql).toContain("c.archived_at is null");
    expect(sql).toContain("lower(trim(cc.value)) = v_sender_ref");
    expect(sql).toContain("trim(cc.value) = v_sender_ref");
    expect(sql).toContain("cc.kind = 'EMAIL'");
    expect(sql).toContain("cc.kind = 'PHONE'");
  });

  it("fails closed for zero, ambiguous, or conflicting request identity", () => {
    expect(sql).toContain("IDENTITY_VERIFIED_MATCH_NOT_FOUND");
    expect(sql).toContain("IDENTITY_VERIFIED_MATCH_AMBIGUOUS");
    expect(sql).toContain("IDENTITY_REQUEST_CUSTOMER_CONFLICT");
  });

  it("links the conversation and compatible request without releasing human takeover", () => {
    expect(sql).toContain("set customer_id = v_customer_id");
    expect(sql).toContain("customer_id = coalesce(customer_id, v_customer_id)");
    expect(sql).not.toMatch(/handover_active\s*=\s*false/);
  });

  it("resolves only the identity attention item and audits without sender/contact values", () => {
    expect(sql).toContain("type = 'INBOUND_IDENTITY'");
    const auditStart = sql.indexOf("insert into public.audit_events");
    const auditEnd = sql.indexOf("return jsonb_build_object", auditStart);
    const audit = sql.slice(auditStart, auditEnd);
    expect(audit).toContain("CONVERSATION_VERIFIED_IDENTITY_RESOLVED");
    expect(audit).not.toContain("v_sender_ref");
    expect(audit).not.toContain("cc.value");
  });

  it("keeps the command service-role-only", () => {
    expect(sql).toContain("revoke all on function public.servicedesk_resolve_conversation_verified_identity(jsonb) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_resolve_conversation_verified_identity(jsonb) to service_role");
  });
});
