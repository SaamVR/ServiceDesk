import { describe, expect, it } from "vitest";
import { buildOperationalIntegrationHealth } from "@/features/operations/integration-health-runtime";

describe("V2 operational integration health", () => {
  it("does not turn implementation capability into a configured-provider claim", () => {
    const health = buildOperationalIntegrationHealth({});
    for (const item of health.filter((entry) => entry.provider !== "PAYMENT")) {
      expect(item.configurationState).toBe("NOT_CONFIGURED");
      expect(item.verificationState).toBe("IMPLEMENTED");
      expect(item.source).toBe("SERVER_CONFIGURATION_PRESENCE");
    }

    const payment = health.find((item) => item.provider === "PAYMENT");
    expect(payment).toMatchObject({
      mode: "SANDBOX",
      configurationState: "CONFIGURED",
      verificationState: "CONTRACT_TESTED",
      source: "INTERNAL_SANDBOX",
    });
    expect(payment?.message).toContain("No live Stripe account");
  });

  it("reports complete server configuration as ready for proof without calling it provider verified", () => {
    const env = {
      WHATSAPP_META_APP_ID: "app",
      WHATSAPP_BUSINESS_ACCOUNT_ID: "business",
      WHATSAPP_PHONE_NUMBER_ID: "phone",
      WHATSAPP_APP_SECRET: "secret-value",
      WHATSAPP_ACCESS_TOKEN: "token-value",
      WHATSAPP_CONTROLLED_RECIPIENT: "recipient",
      WHATSAPP_CALLBACK_URL: "https://example.test/whatsapp",
      WHATSAPP_VERIFY_TOKEN: "verify-value",

      GOOGLE_CALENDAR_CLIENT_ID: "client",
      GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
      GOOGLE_CALENDAR_REDIRECT_URI: "https://example.test/oauth",
      GOOGLE_CALENDAR_REFRESH_TOKEN: "refresh-value",
      GOOGLE_CALENDAR_ID: "calendar",
      GOOGLE_CALENDAR_SCOPES: "freebusy events",
      GOOGLE_CALENDAR_SYNC_READY: "true",

      EMAIL_PROVIDER_ACCOUNT: "provider-account",
      EMAIL_API_KEY: "email-secret-value",
      EMAIL_VERIFIED_DOMAIN: "example.test",
      EMAIL_CALLBACK_SIGNING_SECRET: "callback-secret",
      EMAIL_CONTROLLED_RECIPIENT: "recipient@example.test",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-value",
      SERVICEDESK_EMAIL_WEBHOOK_SECRET: "email-inbound-secret-value",
      SERVICEDESK_EMAIL_ACCOUNT_WORKSPACE_MAP: "{\"mailbox-1\":\"workspace-1\"}",
      SERVICEDESK_VOICE_WEBHOOK_SECRET: "voice-inbound-secret-value",
      SERVICEDESK_VOICE_ACCOUNT_WORKSPACE_MAP: "{\"voice-1\":\"workspace-1\"}",

      N8N_WEBHOOK_URL: "https://n8n.example.test/hook",
      N8N_SIGNING_SECRET: "n8n-secret-value",
      N8N_ALLOWED_HOST: "n8n.example.test",
      N8N_WORKFLOW_ID: "workflow",
      N8N_COMPLETION_CALLBACK_URL: "https://example.test/n8n/callback",

      OPENAI_API_KEY: "model-secret-value",
      AI_MODEL_HEALTH_READY: "true",
    };

    const health = buildOperationalIntegrationHealth(env);
    for (const item of health) {
      expect(item.configurationState).toBe("CONFIGURED");
      expect(item.missingConfiguration).toEqual([]);
    }
    for (const item of health.filter((entry) => entry.provider !== "PAYMENT")) {
      expect(item.verificationState).toBe("IMPLEMENTED");
      expect(item.message).toContain("Controlled provider proof is still required");
    }

    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain("secret-value");
    expect(serialized).not.toContain("refresh-value");
    expect(serialized).not.toContain("token-value");
    expect(serialized).not.toContain("service-role-secret-value");
    expect(serialized).not.toContain("email-inbound-secret-value");
    expect(serialized).not.toContain("voice-inbound-secret-value");
    expect(serialized).not.toContain("mailbox-1");
    expect(serialized).not.toContain("voice-1");
  });

  it("reports partial configuration without exposing configured values", () => {
    const health = buildOperationalIntegrationHealth({
      WHATSAPP_PHONE_NUMBER_ID: "phone-secret-reference",
    });
    const whatsapp = health.find((item) => item.provider === "WHATSAPP");
    expect(whatsapp?.configurationState).toBe("PARTIAL");
    expect(whatsapp?.missingConfiguration.length).toBeGreaterThan(0);
    expect(JSON.stringify(whatsapp)).not.toContain("phone-secret-reference");
  });

  it("reports inbound Email and Voice configuration independently from outbound providers", () => {
    const health = buildOperationalIntegrationHealth({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      SERVICEDESK_EMAIL_WEBHOOK_SECRET: "email-secret",
      SERVICEDESK_EMAIL_ACCOUNT_WORKSPACE_MAP: "{\"mailbox\":\"workspace\"}",
    });

    expect(health.find((item) => item.provider === "EMAIL_INBOUND")).toMatchObject({
      label: "Email inbound",
      configurationState: "CONFIGURED",
      verificationState: "IMPLEMENTED",
      missingConfiguration: [],
      canRunControlledProof: true,
    });
    expect(health.find((item) => item.provider === "VOICE_INBOUND")).toMatchObject({
      label: "Voice inbound",
      configurationState: "PARTIAL",
      verificationState: "IMPLEMENTED",
      canRunControlledProof: false,
    });
    expect(JSON.stringify(health)).not.toContain("email-secret");
  });

});
