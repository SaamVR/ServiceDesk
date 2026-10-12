import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(join(process.cwd(),
  "scripts/release/v4-studio-guest-release-contract.mjs"), "utf8");
const full = readFileSync(join(process.cwd(),
  ".github/workflows/v4-reconciled-full-rc.yml"), "utf8");

describe("V4 real HTTP anonymous staff AI boundary release contract", () => {
  it("keeps the exact compiled server's guest HTTP release suite mandatory", () => {
    expect(full).toContain("node scripts/release/v4-studio-guest-release-contract.mjs");
    expect(full).toContain("Real HTTP guest-route release contract (all 13 modules)");
    expect(full).toContain("pnpm check:rc");
  });

  it("rejects anonymous staff model drafts with exact error codes before any provider operation", () => {
    expect(script).toContain('/api/internal/ai/draft');
    for (const caseName of [
      "missing-origin", "foreign-origin", "cross-site",
      "invalid-role-injection", "no-staff-session",
    ]) expect(script).toContain('name: "' + caseName + '"');
    expect(script).toContain('status: 401, code: "AI_STAFF_UNAUTHORIZED"');
    expect(script).toContain('status: 400, code: "REQUEST_SCHEMA_INVALID"');
    expect(script).toContain('status: 403, code: "SAME_ORIGIN_REQUIRED"');
    expect(script).toContain("anonymousStaffAiDenialCases: staffAiCases.length");
    expect(script).toContain('data?.code === attempt.code');
  });

  it("never supplies credentials or customer/provider data to the real HTTP server", () => {
    expect(script).toContain('const workspace = "fictional-guest-no-session"');
    expect(script).toContain('conversationId: "fictional-conversation"');
    expect(script).toContain('messageId: "fictional-message"');
    expect(script).not.toContain("OPENAI_API_KEY");
    expect(script).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(script).not.toContain('"authorization":');
    expect(script).not.toContain('"cookie":');
  });
});
