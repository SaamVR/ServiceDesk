import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0052_v2_retention_campaign_dispatch_guard.sql"),
  "utf8",
);

describe("V2 retention campaign dispatch governance", () => {
  it("models capped opt-in campaigns and per-customer retention controls", () => {
    expect(sql).toContain("create table if not exists public.retention_campaigns");
    expect(sql).toContain("daily_cap integer");
    expect(sql).toContain("per_customer_cap integer");
    expect(sql).toContain("quiet_hours_start");
    expect(sql).toContain("quiet_hours_end");
    expect(sql).toContain("create table if not exists public.customer_retention_controls");
    expect(sql).toContain("'ACTIVE','PAUSED','SUPPRESSED'");
  });

  it("rechecks the latest channel consent at dispatch time", () => {
    const start = sql.indexOf("servicedesk_check_retention_campaign_dispatch_eligibility");
    const end = sql.indexOf("create or replace function public.servicedesk_upsert_retention_campaign", start);
    const guard = sql.slice(start, end);
    expect(guard).toContain("from public.communication_consents");
    expect(guard).toContain("order by cc.recorded_at desc");
    expect(guard).toContain("v_consent_status is distinct from 'GRANTED'");
    expect(guard).toContain("RECIPIENT_OPTED_OUT");
    expect(guard).toContain("MISSING_OPT_IN");
  });

  it("checks pause/suppression, verified destination, quiet hours and caps before provider execution", () => {
    expect(sql).toContain("RETENTION_CONTACT_SUPPRESSED");
    expect(sql).toContain("RETENTION_CONTACT_PAUSED");
    expect(sql).toContain("VERIFIED_CONTACT_REQUIRED");
    expect(sql).toContain("VERIFIED_CONTACT_AMBIGUOUS");
    expect(sql).toContain("QUIET_HOURS");
    expect(sql).toContain("CAMPAIGN_DAILY_CAP");
    expect(sql).toContain("CAMPAIGN_CUSTOMER_CAP");
    expect(sql).toContain("o.status = 'SENT'");
  });

  it("queues only identifiers and resolves recipient/content authoritatively at dispatch time", () => {
    const queueStart = sql.indexOf("servicedesk_queue_retention_campaign_message");
    const queueEnd = sql.indexOf("servicedesk_resolve_retention_campaign_intent", queueStart);
    const queue = sql.slice(queueStart, queueEnd);
    expect(queue).toContain("'campaignId', v_campaign");
    expect(queue).toContain("'customerId', v_customer");
    expect(queue).toContain("'channel', v_channel");
    expect(queue).not.toContain("'recipientRef'");
    expect(queue).not.toContain("'bodyText'");
    expect(sql).toContain("servicedesk_resolve_retention_campaign_intent");
    expect(sql).toContain("servicedesk_check_retention_campaign_dispatch_eligibility");
  });

  it("keeps management and dispatch functions behind service-role RPCs", () => {
    for (const fn of [
      "servicedesk_check_retention_campaign_dispatch_eligibility",
      "servicedesk_upsert_retention_campaign",
      "servicedesk_set_customer_retention_control",
      "servicedesk_queue_retention_campaign_message",
      "servicedesk_resolve_retention_campaign_intent",
    ]) {
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\(jsonb\\)\\s+to service_role`));
    }
    expect(sql).toContain("v_actor_role <> 'OWNER'");
    expect(sql).toContain("servicedesk_require_staff");
  });

  it("uses valid dollar-quoted PL/pgSQL bodies for every campaign function", () => {
    expect(sql).not.toMatch(/\bas \$\s*\ndeclare/);
    expect(sql).not.toMatch(/\n\$;\s*(?:\n|$)/);
    const bodies = sql.match(/\bas \$\$/g) ?? [];
    const terminators = sql.match(/\$\$;/g) ?? [];
    expect(bodies.length).toBe(5);
    expect(terminators.length).toBe(5);
  });

});
