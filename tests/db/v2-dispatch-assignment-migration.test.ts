import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0016_v2_dispatch_assignment.sql"),
  "utf8",
);

describe("V2 dispatch assignment migration contract", () => {
  it("keeps assignment service-role-only and security invoker", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("servicedesk_require_staff");
    expect(sql).toContain("revoke all on function public.servicedesk_assign_visit_crew(jsonb) from authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_assign_visit_crew(jsonb) to service_role");
  });

  it("guards version, active crew, overlap and idempotency", () => {
    expect(sql).toContain("VERSION_CONFLICT");
    expect(sql).toContain("CREW_NOT_AVAILABLE");
    expect(sql).toContain("CREW_SCHEDULE_CONFLICT");
    expect(sql).toContain("assign_visit_crew");
    expect(sql).toContain("pg_advisory_xact_lock");
  });
});
