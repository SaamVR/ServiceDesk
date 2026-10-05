import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0021_v2_sandbox_checkout_sessions.sql"),
  "utf8",
);

describe("V2 sandbox checkout session migration", () => {
  it("keeps checkout sessions non-authoritative and server-owned", () => {
    expect(sql).toContain("create table if not exists public.sandbox_checkout_sessions");
    expect(sql).toContain("purpose text not null check (purpose = 'BALANCE')");
    expect(sql).toContain("alter table public.sandbox_checkout_sessions enable row level security");
    expect(sql).toContain("revoke all on table public.sandbox_checkout_sessions from anon");
    expect(sql).toContain("revoke all on table public.sandbox_checkout_sessions from authenticated");
    expect(sql).toContain("grant select, insert, update, delete on table public.sandbox_checkout_sessions to service_role");
    expect(sql).toContain("Never authoritative for paid invoice or visit state");
  });

  it("binds sessions to workspace customer quote and invoice scope", () => {
    expect(sql).toContain("foreign key (workspace_id, customer_id)");
    expect(sql).toContain("references public.customers(workspace_id, id)");
    expect(sql).toContain("foreign key (workspace_id, quote_id)");
    expect(sql).toContain("references public.quotes(workspace_id, id)");
    expect(sql).toContain("foreign key (workspace_id, invoice_id)");
    expect(sql).toContain("references public.invoices(workspace_id, id)");
  });
});
