import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0047_v2_inbound_operations_observability.sql"),
  "utf8",
);

describe("V2 inbound operations observability migration", () => {
  it("returns aggregate Email, WhatsApp and Voice operational health", () => {
    expect(sql).toContain("servicedesk_read_inbound_operations_snapshot");
    expect(sql).toContain("provider_inbound_receipts");
    expect(sql).toContain("voice_call_intakes");
    expect(sql).toContain("'EMAIL'");
    expect(sql).toContain("'WHATSAPP'");
    expect(sql).toContain("pendingCallbackCount");
  });

  it("counts unresolved identity through attention state without exposing sender data", () => {
    expect(sql).toContain("a.type = 'INBOUND_IDENTITY'");
    expect(sql).toContain("a.status = 'OPEN'");
    const returned = sql.slice(sql.indexOf("return jsonb_build_object"));
    expect(returned).not.toContain("sender_ref");
    expect(returned).not.toContain("provider_account_id");
    expect(returned).not.toContain("raw_provider_event_ref");
  });

  it("bounds the reporting window and enforces staff authorization", () => {
    expect(sql).toContain("v_hours < 1 or v_hours > 168");
    expect(sql).toContain("servicedesk_require_staff");
    expect(sql).toContain("v_actor_role not in ('OWNER','DISPATCHER')");
  });

  it("keeps the aggregate read service-role-only", () => {
    expect(sql).toContain("revoke all on function public.servicedesk_read_inbound_operations_snapshot(jsonb) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_read_inbound_operations_snapshot(jsonb) to service_role");
  });
});
