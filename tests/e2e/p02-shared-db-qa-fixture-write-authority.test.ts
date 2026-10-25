import { describe, expect, it } from "vitest";
import { qaFixtureWritesAllowed } from "../../src/features/auth/qa-fixture-write-authority";

const configured: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "https://qa-example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  SERVICEDESK_AUTH_REDIRECT_ORIGIN: "https://servicedesk-v3-frontend-review.onrender.com",
  SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED: "true",
  SERVICEDESK_OWNER_REGISTRATION_ENABLED: "false",
  SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: "true",
  SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS: "owner-one@example.test",
  SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED: "true",
  SERVICEDESK_QA_FIXTURE_WRITES_APPROVED: "true",
};

describe("P02 shared main Supabase synthetic fixture write authority", () => {
  it("requires separate explicit approval beyond QA account allowlist and RLS mode", () => {
    for (const value of [undefined, "", "TRUE", "1", "false"]) {
      expect(qaFixtureWritesAllowed({
        ...configured, SERVICEDESK_QA_FIXTURE_WRITES_APPROVED: value,
      })).toBe(false);
    }
    expect(qaFixtureWritesAllowed(configured)).toBe(true);
  });

  it("refuses enabling fixtures for unapproved security, public signup or elevated database clients", () => {
    for (const env of [
      { SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED: "false" },
      { SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true" },
      { SUPABASE_SERVICE_ROLE_KEY: "test-value-not-a-real-secret" },
      { SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS: "" },
      { SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED: "false" },
      { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined },
    ]) {
      expect(qaFixtureWritesAllowed({ ...configured, ...env })).toBe(false);
    }
  });

  it("requires both the UI and server action to enforce the write gate", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/onboarding/verified/page.tsx", "utf8");
    const action = readFileSync("src/app/onboarding/verified/qa-seed-actions.ts", "utf8");
    expect(page).toContain("qaFixtureWritesAllowed()");
    expect(action).toContain("qaFixtureWritesAllowed()");
    expect(action.indexOf("qaFixtureWritesAllowed()"))
      .toBeLessThan(action.indexOf("seedQaWorkspaceData("));
  });
});
