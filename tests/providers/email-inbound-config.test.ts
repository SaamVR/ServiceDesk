import { describe, expect, it } from "vitest";
import { readEmailInboundRuntimeConfig } from "../../src/server/integrations/email/inbound-config";

describe("email inbound runtime config", () => {
  it("returns only server-side routing/config references", () => {
    const result = readEmailInboundRuntimeConfig({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
      SERVICEDESK_EMAIL_WEBHOOK_SECRET: "secret-test",
      SERVICEDESK_EMAIL_ACCOUNT_WORKSPACE_MAP: JSON.stringify({ "mailbox-1": "workspace-1" }),
    });
    expect(result).toEqual({
      ok: true,
      value: {
        supabaseUrl: "https://example.supabase.co",
        serviceRoleKey: "service-role-test",
        webhookSecret: "secret-test",
        workspaceByProviderAccountId: { "mailbox-1": "workspace-1" },
      },
    });
  });

  it("fails closed when account routing is absent or malformed", () => {
    const base = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
      SERVICEDESK_EMAIL_WEBHOOK_SECRET: "secret-test",
    };
    expect(readEmailInboundRuntimeConfig(base)).toMatchObject({ ok: false, code: "EMAIL_INBOUND_ACCOUNT_MAP_MISSING" });
    expect(readEmailInboundRuntimeConfig({ ...base, SERVICEDESK_EMAIL_ACCOUNT_WORKSPACE_MAP: "[]" }))
      .toMatchObject({ ok: false, code: "EMAIL_INBOUND_ACCOUNT_MAP_MISSING" });
  });
});
