import { describe, expect, it } from "vitest";
import { readVoiceInboundRuntimeConfig } from "../../src/server/integrations/voice/inbound-config";

describe("voice inbound runtime config", () => {
  it("loads only server-side voice ingress configuration", () => {
    const result = readVoiceInboundRuntimeConfig({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
      SERVICEDESK_VOICE_WEBHOOK_SECRET: "voice-secret",
      SERVICEDESK_VOICE_ACCOUNT_WORKSPACE_MAP: JSON.stringify({ "voice-account-1": "workspace-1" }),
    });
    expect(result).toEqual({
      ok: true,
      value: {
        supabaseUrl: "https://example.supabase.co",
        serviceRoleKey: "service-role-test",
        webhookSecret: "voice-secret",
        workspaceByProviderAccountId: { "voice-account-1": "workspace-1" },
      },
    });
  });

  it("fails closed when routing is missing or malformed", () => {
    const base = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
      SERVICEDESK_VOICE_WEBHOOK_SECRET: "voice-secret",
    };
    expect(readVoiceInboundRuntimeConfig(base))
      .toMatchObject({ ok: false, code: "VOICE_INBOUND_ACCOUNT_MAP_MISSING" });
    expect(readVoiceInboundRuntimeConfig({ ...base, SERVICEDESK_VOICE_ACCOUNT_WORKSPACE_MAP: "{}" }))
      .toMatchObject({ ok: false, code: "VOICE_INBOUND_ACCOUNT_MAP_MISSING" });
  });
});
