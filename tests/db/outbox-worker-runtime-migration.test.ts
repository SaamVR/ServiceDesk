import { describe, expect, it } from "vitest";
import fs from "node:fs";

const sql = fs.readFileSync("supabase/migrations/0006_outbox_worker_runtime.sql", "utf8");

describe("outbox worker runtime migration", () => {
  it("adds honest terminal suppression and worker runtime metadata", () => {
    expect(sql).toContain("alter type public.outbox_status add value if not exists 'SUPPRESSED'");
    expect(sql).toContain("provider_reference text");
    expect(sql).toContain("last_error_code text");
    expect(sql).toContain("outbox_ready_claim_idx");
    expect(sql).toContain("outbox_stale_lease_idx");
  });

  it("uses a trusted atomic claim function with skip locked and lease expiry", () => {
    expect(sql).toContain("create or replace function public.claim_ready_outbox_events");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("o.status = 'PENDING'");
    expect(sql).toContain("o.next_attempt_at is null or o.next_attempt_at <= p_now");
    expect(sql).toContain("o.locked_at + make_interval(secs => p_lease_seconds) <= p_now");
    expect(sql).toContain("attempts = claimed.attempts + 1");
  });

  it("does not grant public or authenticated mutation authority", () => {
    expect(sql).toContain("revoke all on function public.claim_ready_outbox_events");
    expect(sql).not.toContain("grant execute on function public.claim_ready_outbox_events");
  });
});
