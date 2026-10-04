import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("E03 payment persistence migration", () => {
  it("declares invoice/payment application tables, identities and trusted write posture", () => {
    const sql = readFileSync("supabase/migrations/0005_invoices_payment_applications.sql", "utf8");
    expect(sql).toContain("create table public.invoices");
    expect(sql).toContain("create table public.verified_payment_applications");
    expect(sql).toContain("unique (provider, provider_account_id, provider_event_id)");
    expect(sql).toContain("unique (workspace_id, provider_account_id, provider_transaction_id, purpose)");
    expect(sql).toContain("check ((allocated_minor - refunded_minor) + balance_minor = total_minor)");
    expect(sql).toContain("alter table public.invoices enable row level security");
    expect(sql).not.toContain("for insert with check (true)");
  });
});
