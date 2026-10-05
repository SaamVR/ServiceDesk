import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0019_v2_customer_communication_preferences.sql"),
  "utf8",
);

describe("V2 customer communication preference command", () => {
  it("is service-role-only and validates customer ownership", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("c.auth_user_id = v_actor_user");
    expect(sql).toContain("v_actor_role <> 'CUSTOMER'");
    expect(sql).toContain("revoke all on function public.servicedesk_record_customer_consent(jsonb) from authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_record_customer_consent(jsonb) to service_role");
  });

  it("appends audited consent history with stale-page and idempotency protection", () => {
    expect(sql).toContain("insert into public.communication_consents");
    expect(sql).toContain("CUSTOMER_PORTAL");
    expect(sql).toContain("CONSENT_VERSION_CONFLICT");
    expect(sql).toContain("customer.consent.record");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("insert into public.audit_events");
    expect(sql).not.toContain("update public.communication_consents");
  });
});