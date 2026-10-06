import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "src/app/api/providers/email/inbound/route.ts"), "utf8");

describe("email inbound Next route", () => {
  it("uses server-only config and authoritative Postgres conversation facade", () => {
    expect(route).toContain("readEmailInboundRuntimeConfig()");
    expect(route).toContain("createPostgresConversationFacadeMethods");
    expect(route).toContain("SUPABASE_SERVICE_ROLE_KEY").not;
    expect(route).not.toContain("console.log");
  });

  it("fails closed when configuration is absent and returns no-store responses", () => {
    expect(route).toContain('status: 503');
    expect(route).toContain('"Cache-Control": "no-store"');
  });
});
