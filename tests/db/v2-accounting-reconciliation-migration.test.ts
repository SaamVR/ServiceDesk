import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) =>
  readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

const schema = source("0031_v2_accounting_reconciliation_schema.sql");
const read = source("0032_v2_accounting_reconciliation_read.sql");
const integration = source("0033_v2_accounting_integration_runtime.sql");
const record = source("0034_v2_accounting_reconciliation_record.sql");

describe("V2 accounting reconciliation migrations", () => {
  it("stores normalized reconciliation metadata without provider credentials", () => {
    expect(schema).toContain("create table if not exists public.accounting_integrations");
    expect(schema).toContain("create table if not exists public.accounting_reconciliation_records");
    expect(schema).toContain("local_resource_kind");
    expect(schema).toContain("payload_fingerprint");
    expect(schema).toContain("state in ('PENDING','SYNCED','CONFLICT','ERROR')");
    expect(schema).not.toMatch(/access_token|refresh_token|client_secret|oauth_token/i);
  });

  it("keeps payment and credit authorities explicit", () => {
    expect(schema).toContain("'VERIFIED_PAYMENT'");
    expect(schema).toContain("'MANUAL_PAYMENT'");
    expect(schema).toContain("'COMMERCIAL_BILLING_LINE'");
    expect(schema).toContain("entity_type = 'PAYMENT'");
    expect(schema).toContain("local_resource_kind in ('VERIFIED_PAYMENT','MANUAL_PAYMENT')");
    expect(schema).toContain("unique (workspace_id, integration_id, entity_type, local_resource_kind, local_resource_id)");
  });

  it("resolves local versions against authoritative ServiceDesk sources", () => {
    expect(integration).toContain("servicedesk_accounting_local_version");
    expect(integration).toContain("from public.commercial_organizations");
    expect(integration).toContain("from public.invoices");
    expect(integration).toContain("from public.verified_payment_applications");
    expect(integration).toContain("from public.manual_payment_records");
    expect(integration).toContain("from public.commercial_billing_lines l");
    expect(integration).toContain("d.state = 'FINALIZED'");
  });

  it("does not claim a successful sync merely because connection state is ready", () => {
    expect(integration).toContain("last_success_at = last_success_at");
    expect(integration).toContain("null,");
    expect(record).toContain("set last_success_at = v_now");
  });

  it("rejects stale/ahead local state and promotes external identity drift to conflict", () => {
    expect(record).toContain("ACCOUNTING_LOCAL_VERSION_STALE");
    expect(record).toContain("ACCOUNTING_LOCAL_VERSION_AHEAD");
    expect(record).toContain("EXTERNAL_ID_MISMATCH");
    expect(record).toContain("EXTERNAL_VERSION_CHANGED");
    expect(record).toContain("ACCOUNTING_IDEMPOTENCY_CONFLICT");
    expect(record).toContain("state = 'CONFLICT'");
  });

  it("opens and resolves operational attention without logging provider payloads", () => {
    expect(integration).toContain("'ACCOUNTING_RECONCILIATION'");
    expect(record).toContain("'ACCOUNTING_RECONCILIATION'");
    expect(record).toContain("status = 'RESOLVED'");
    expect(record).not.toMatch(/raw_payload|provider_payload|request_body|response_body/i);
  });

  it("keeps reads staff-scoped and mutation RPCs service-role-only", () => {
    expect(read).toContain("v_actor_role not in ('OWNER','DISPATCHER')");
    expect(read).toContain("servicedesk_require_staff");
    expect(read).toContain("grant execute on function public.servicedesk_read_accounting_reconciliation_snapshot(jsonb) to service_role");
    expect(integration).toContain("grant execute on function public.servicedesk_set_accounting_integration_state(jsonb) to service_role");
    expect(record).toContain("grant execute on function public.servicedesk_record_accounting_reconciliation(jsonb) to service_role");
    expect(integration).toContain("from public, anon, authenticated");
    expect(record).toContain("from public, anon, authenticated");
  });
});
