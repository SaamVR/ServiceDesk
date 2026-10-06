import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0043_v2_email_inbound_message.sql"),
  "utf8",
);

describe("V2 inbound email migration", () => {
  it("adds a dedicated email authority without replacing the WhatsApp RPC", () => {
    expect(sql).toContain("servicedesk_apply_inbound_email_message");
    expect(sql).toContain("v_channel <> 'EMAIL'");
    expect(sql).not.toContain("create or replace function public.servicedesk_apply_inbound_message");
  });

  it("deduplicates on provider account plus receipt/message identity", () => {
    expect(sql).toContain("provider = 'EMAIL'");
    expect(sql).toContain("provider_account_id = v_account");
    expect(sql).toContain("provider_receipt_key = v_receipt_key or provider_message_id = v_message_id");
    expect(sql).toContain("'state', 'DUPLICATE'");
  });

  it("links only an exact, verified, unarchived email identity", () => {
    expect(sql).toContain("cc.kind = 'EMAIL'");
    expect(sql).toContain("lower(trim(cc.value)) = v_sender_ref");
    expect(sql).toContain("cc.verified_at is not null");
    expect(sql).toContain("c.archived_at is null");
    expect(sql).toContain("if v_contact_count = 1 then");
  });

  it("forces handover when sender identity is unresolved or ambiguous", () => {
    expect(sql).toContain("if v_contact_count <> 1 then");
    expect(sql).toContain("handover_active = true");
    expect(sql).toContain("'INBOUND_IDENTITY'");
    expect(sql).toContain("Inbound email has no verified customer match.");
    expect(sql).toContain("Inbound email matches multiple verified customer contacts.");
  });

  it("supports text only and does not persist a raw provider payload", () => {
    expect(sql).toContain("v_kind <> 'TEXT'");
    expect(sql).toContain("'TEXT'");
    expect(sql).toContain("raw_provider_event_ref");
    expect(sql).not.toMatch(/raw_provider_payload|raw_payload jsonb|provider_payload/i);
  });

  it("uses EMAIL conversation identity and can attach later-resolved customer context", () => {
    expect(sql).toContain("v_thread := 'EMAIL:' || v_account || ':' || v_sender_ref");
    expect(sql).toContain("channel = 'EMAIL'");
    expect(sql).toContain("customer_id = coalesce(customer_id, v_customer_id)");
    expect(sql).toContain("request_id = coalesce(request_id, v_request_id)");
  });

  it("keeps mutation service-role-only", () => {
    expect(sql).toContain(
      "revoke all on function public.servicedesk_apply_inbound_email_message(jsonb) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.servicedesk_apply_inbound_email_message(jsonb) to service_role",
    );
  });
});
