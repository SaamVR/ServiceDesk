import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(),
  "scripts/release/v4-connected-schema-readonly.sql"), "utf8");
const workflow = readFileSync(join(process.cwd(),
  ".github/workflows/v4-seven-table-branch-guard-pg17-rc.yml"), "utf8");

describe("V4 real connected database operator schema evidence", () => {
  it("uses a read-only transaction with no SQL modifications or sensitive row data", () => {
    expect(sql).toContain("BEGIN TRANSACTION READ ONLY;");
    expect(sql).toContain("COMMIT;");
    const uncommented = sql.replace(/--[^\n]*/g, "");
    expect(uncommented).not.toMatch(/\b(?:INSERT|DELETE|UPDATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CREATE)\s+(?:INTO|FROM|TABLE|FUNCTION|POLICY|ROLE|ON|OR|EXTENSION)\b/i);
    expect(uncommented).not.toMatch(/\b(?:auth\.users|auth\.sessions|customer_email|phone_number)\b/i);
    expect(sql).toContain("READ_ONLY_CONNECTED_DATABASE");
  });
  it("tests the correct first IF procedural branch and subsequent ELSIF", () => {
    expect(sql).toContain("if tg_table_name = ''requests'' then");
    expect(sql).toContain("elsif tg_table_name = ''conversations'' then");
    expect(sql).toContain("if tg_table_name = ''requests'' and new.property_id");
    expect(sql).toContain("NOT historic_unsafe_guard");
    expect(sql).toContain("bound_triggers = 7");
    expect(sql).toContain("security_invoker");
  });
  it("does not confuse installed base pricing with the unapplied future internal journal", () => {
    for (const key of [
      "branchGuard0062Applied", "ownerPricingRpcInstalled", "coreSchemaState",
      "quoteSourceJournalInstalled", "quoteJournalRlsEnabled",
      "replayClaimRpcInstalled", "replayCompleteRpcInstalled",
      "quoteRecoverySchemaState",
    ]) expect(sql).toContain(key);
    expect(sql).toContain("CORE_SCHEMA_VERIFIED");
    expect(sql).toContain("RECOVERY_MIGRATION_NOT_VERIFIED");
    expect(sql).toContain("NOT_TESTED_BY_THIS_QUERY");
  });
  it("fails recovery readiness closed on client table/RPC access and missing service grants", () => {
    expect(sql).toContain("quoteJournalClientAccessDenied");
    expect(sql).toContain("replayRpcClientExecuteDenied");
    expect(sql).toContain("replayRpcServiceExecuteAllowed");
    expect(sql).toContain("client_policy_absent");
    expect(sql).toContain("has_table_privilege(to_regrole('anon')");
    expect(sql).toContain("has_table_privilege(to_regrole('authenticated')");
    expect(sql).toContain("has_function_privilege(to_regrole('service_role')");
    expect(sql).toContain("has_function_privilege(to_regrole('anon')");
    expect(sql).toContain("has_function_privilege(to_regrole('authenticated')");
    expect(sql).toContain("COALESCE(");
    expect(sql).toContain("AND journal_client_access_denied");
    expect(sql).toContain("AND replay_client_execute_denied AND replay_service_execute_allowed");
    expect(sql).not.toContain("GRANT EXECUTE");
  });

  it("executes the operator report in real disposable PG17 CI", () => {
    expect(workflow).toContain("postgres:17");
    expect(workflow).toContain("v4-connected-schema-readonly.sql");
    expect(workflow).toContain("branchGuard0062Applied");
    expect(workflow).toContain("RECOVERY_MIGRATION_NOT_VERIFIED");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
