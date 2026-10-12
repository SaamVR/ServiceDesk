import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0062_v4_branch_trigger_rowtype_guard.sql"),
  "utf8",
);

describe("V4 shared branch trigger row-type regression", () => {
  it("replaces the existing shared function without dropping trigger bindings or widening privileges", () => {
    expect(sql).toContain("create or replace function public.servicedesk_apply_branch_defaults_and_consistency()");
    expect(sql).toContain("returns trigger");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = public, pg_temp");
    expect(sql).not.toMatch(/drop\s+(?:trigger|table|function|schema)\b/i);
    expect(sql).not.toMatch(/\bgrant\b/i);
  });

  it("procedurally isolates every table-specific NEW field from unrelated trigger row types", () => {
    // Boolean 'tg_table_name = ... AND NEW.field' is NOT a safe row-type guard.
    // It caused the real owner RLS properties insert to fail with SQLSTATE 42703.
    expect(sql).not.toMatch(/tg_table_name\s*=\s*'[^']+'\s+and\s+new\./i);
    for (const table of [
      "requests", "conversations", "capacity_slots", "visits", "recurrence_rules",
    ]) {
      expect(sql).toContain(`tg_table_name = '${table}' then`);
    }
    expect(sql).toContain("new.branch_id := coalesce(");
    expect(sql).toContain("public.servicedesk_default_branch(new.workspace_id)");
  });

  it("retains active-branch enforcement and every cross-branch rejection contract", () => {
    for (const expectedCode of [
      "BRANCH_NOT_AVAILABLE",
      "REQUEST_PROPERTY_BRANCH_MISMATCH",
      "CONVERSATION_REQUEST_BRANCH_MISMATCH",
      "CAPACITY_CREW_BRANCH_MISMATCH",
      "VISIT_REQUEST_BRANCH_MISMATCH",
      "VISIT_CREW_BRANCH_MISMATCH",
      "VISIT_SLOT_BRANCH_MISMATCH",
      "RECURRENCE_BRANCH_MISMATCH",
    ]) {
      expect(sql).toContain(expectedCode);
    }
    expect(sql).toContain("where b.workspace_id = new.workspace_id and b.id = new.branch_id and b.active");
    expect(sql).toContain("return new;");
  });

  it("preserves current seven-table trigger registrations from the original migration", () => {
    const original = readFileSync(
      join(process.cwd(), "supabase/migrations/0053_v2_multibranch_core.sql"),
      "utf8",
    );
    for (const table of [
      "properties", "requests", "conversations", "crews", "capacity_slots",
      "visits", "recurrence_rules",
    ]) {
      expect(original).toContain(`create trigger ${table}_branch_guard`);
      expect(original).toContain("for each row execute function public.servicedesk_apply_branch_defaults_and_consistency()");
    }
  });
});
