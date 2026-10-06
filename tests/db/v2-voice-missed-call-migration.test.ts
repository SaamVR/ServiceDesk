import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0044_v2_voice_missed_call_intake.sql"),
  "utf8",
);

describe("V2 missed-call intake migration", () => {
  it("creates durable provider-call identity and exact dedupe", () => {
    expect(sql).toContain("create table if not exists public.voice_call_intakes");
    expect(sql).toContain("unique (workspace_id, provider_account_id, provider_call_id)");
    expect(sql).toContain("on conflict (workspace_id, provider_account_id, provider_call_id) do nothing");
    expect(sql).toContain("'duplicate', true");
  });

  it("creates an anonymous request rather than identifying a customer from caller ID", () => {
    expect(sql).toContain("'VOICE:' || v_intake.id::text");
    expect(sql).toContain("'sourceChannel', 'VOICE'");
    expect(sql).toContain("'sourceKind', 'MISSED_CALL'");
    expect(sql).toContain("'callbackRequired', true");
    expect(sql).toContain("'callbackContactRef', v_caller");
    expect(sql).not.toMatch(/customer_contacts|customer_id\s*=/i);
  });

  it("creates a staff callback attention item without PII in its summary", () => {
    expect(sql).toContain("'VOICE_CALLBACK', 'request', v_request.id");
    expect(sql).toContain("'Missed call requires staff callback.'");
    expect(sql).not.toContain("'Missed call from '");
  });

  it("rejects recording/transcript input and stores neither media type", () => {
    expect(sql).toContain("p_event ? 'transcript'");
    expect(sql).toContain("p_event ? 'recordingUrl'");
    expect(sql).toContain("VOICE_MEDIA_NOT_ALLOWED");
    expect(sql).not.toMatch(/recording_url\s+text|transcript\s+text/i);
  });

  it("keeps audit metadata free of the caller reference", () => {
    const auditStart = sql.indexOf("insert into public.audit_events");
    const auditEnd = sql.indexOf("return jsonb_build_object", auditStart);
    const audit = sql.slice(auditStart, auditEnd);
    expect(audit).toContain("VOICE_MISSED_CALL_CAPTURED");
    expect(audit).not.toContain("v_caller");
    expect(audit).not.toContain("callerRef");
  });

  it("keeps the command service-role-only", () => {
    expect(sql).toContain("revoke all on function public.servicedesk_apply_missed_voice_call(jsonb) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_apply_missed_voice_call(jsonb) to service_role");
  });
});
