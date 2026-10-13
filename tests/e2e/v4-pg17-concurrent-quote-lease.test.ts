import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(join(process.cwd(),
  "scripts/release/v4-quote-source-pg17-concurrency.sh"),"utf8");
const workflow = readFileSync(join(process.cwd(),
  ".github/workflows/v4-quote-source-recovery-rc.yml"),"utf8");

describe("V4 real two-connection PG17 source lease test", () => {
  it("cannot connect to any target except explicit local disposable PG17", () => {
    expect(script).toContain('SERVICEDESK_PG17_DISPOSABLE_ONLY:-');
    expect(script).toContain('PGHOST:-');
    expect(script).toContain('127.0.0.1');
    expect(script).toContain('PGDATABASE:-');
    expect(script).toContain('servicedesk_migration_test');
    expect(script).toContain('PGUSER:-');
    expect(script).toContain('postgres');
    expect(script).toContain('exit 2');
    expect(script).not.toContain("supabase.co");
    expect(script).not.toContain("SERVICE_ROLE_KEY");
  });
  it("proves row lock before issuing the second concurrent lease claim", () => {
    expect(script).toContain("FOR UPDATE;");
    expect(script).toContain("SELECT pg_sleep(6)");
    expect(script).toContain("pg_stat_activity");
    expect(script).toContain("worker_SKIP_01");
    expect(script).toContain("worker_AFTER_01");
    expect(script).toContain("worker_DOUBLE_01");
    expect(script).toContain("PROCESSING:1:worker_AFTER_01");
    expect(script).toContain("PG17_QUOTE_SOURCE_REAL_CONCURRENT_CLAIM_PASS");
  });
  it("runs SQL migration, atomic acceptance proof and live concurrency test in one isolated service", () => {
    expect(workflow).toContain("image: postgres:17");
    expect(workflow).toContain('SERVICEDESK_PG17_DISPOSABLE_ONLY: "1"');
    expect(workflow).toContain("0063_v4_quote_accept_internal_source_journal.sql");
    expect(workflow).toContain("v4-quote-source-pg17-acceptance.sql");
    expect(workflow).toContain("bash scripts/release/v4-quote-source-pg17-concurrency.sh");
    expect(workflow).toContain("persist-credentials: false");
  });
});
