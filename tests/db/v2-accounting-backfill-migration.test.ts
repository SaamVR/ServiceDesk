import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0035_v2_accounting_backfill_dry_run.sql"),
  "utf8",
);

describe("V2 accounting dry-run backfill migration", () => {
  it("is a staff-scoped read-only planner", () => {
    expect(sql).toContain("servicedesk_plan_accounting_backfill");
    expect(sql).toContain("v_actor_role not in ('OWNER','DISPATCHER')");
    expect(sql).toContain("servicedesk_require_staff");
    expect(sql).toContain("ACCOUNTING_INTEGRATION_NOT_READY");
    expect(sql).not.toMatch(/\binsert\s+into\b/i);
    expect(sql).not.toMatch(/\bupdate\s+public\./i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("plans every supported local accounting authority without provider payloads", () => {
    expect(sql).toContain("'COMMERCIAL_ORGANIZATION'");
    expect(sql).toContain("'INVOICE'");
    expect(sql).toContain("'VERIFIED_PAYMENT'");
    expect(sql).toContain("'MANUAL_PAYMENT'");
    expect(sql).toContain("'COMMERCIAL_BILLING_LINE'");
    expect(sql).not.toMatch(/raw_payload|request_body|response_body|access_token|refresh_token/i);
  });

  it("separates unsynced candidates from review-blocked and pending records", () => {
    expect(sql).toContain("'UNTRACKED'");
    expect(sql).toContain("'LOCAL_VERSION_ADVANCED'");
    expect(sql).toContain("reconciliation_state in ('CONFLICT','ERROR')");
    expect(sql).toContain("reconciliation_state = 'PENDING'");
    expect(sql).toContain("reconciliation_state = 'SYNCED'");
  });

  it("returns an explicit dry-run plan and never exceeds the bounded preview limit", () => {
    expect(sql).toContain("'dryRun', true");
    expect(sql).toContain("'candidateCount'");
    expect(sql).toContain("'blockedCount'");
    expect(sql).toContain("'pendingCount'");
    expect(sql).toContain("'currentCount'");
    expect(sql).toContain("least(coalesce");
    expect(sql).toContain(", 500)");
  });

  it("keeps execution service-role-only", () => {
    expect(sql).toContain(
      "revoke all on function public.servicedesk_plan_accounting_backfill(jsonb) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.servicedesk_plan_accounting_backfill(jsonb) to service_role",
    );
  });
});
