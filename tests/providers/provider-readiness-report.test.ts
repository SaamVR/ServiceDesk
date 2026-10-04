import { describe, expect, test } from "vitest";
import { summarizeProviderReadiness } from "../../src/server/integrations/configuration/readiness";
import type { ProviderConfigurationCheck } from "../../src/server/integrations";

function check(provider: ProviderConfigurationCheck["provider"], status: ProviderConfigurationCheck["status"], requirements: string[] = []): ProviderConfigurationCheck {
  return {
    provider,
    mode: "SANDBOX",
    status,
    requiredConfiguration: requirements,
    evidence: {
      provider,
      mode: "SANDBOX",
      verification: status,
      capturedAt: "2026-10-04T12:00:00.000Z",
      notes: requirements,
    },
  };
}

describe("provider readiness report", () => {
  test("blocks provider verification when any provider has missing configuration", () => {
    const summary = summarizeProviderReadiness([
      check("WHATSAPP", "CONFIGURATION_BLOCKED", ["META_APP_SECRET", "CONTROLLED_RECIPIENT"]),
      check("GOOGLE_CALENDAR", "CONTRACT_TESTED"),
      check("PAYMENT", "CONTRACT_TESTED"),
    ]);

    expect(summary).toMatchObject({
      overall: "CONFIGURATION_BLOCKED",
      providerVerifiedReady: false,
      blockedProviders: ["WHATSAPP"],
    });
    expect(summary.missingConfiguration).toEqual(["WHATSAPP:META_APP_SECRET", "WHATSAPP:CONTROLLED_RECIPIENT"]);
  });

  test("reports contract tested when all providers are configured but not real-proofed", () => {
    const summary = summarizeProviderReadiness([
      check("WHATSAPP", "CONTRACT_TESTED"),
      check("GOOGLE_CALENDAR", "CONTRACT_TESTED"),
      check("PAYMENT", "CONTRACT_TESTED"),
    ]);

    expect(summary).toMatchObject({ overall: "CONTRACT_TESTED", providerVerifiedReady: false, blockedProviders: [] });
  });

  test("reports provider verified only when every provider is provider verified", () => {
    const summary = summarizeProviderReadiness([
      check("WHATSAPP", "PROVIDER_VERIFIED"),
      check("GOOGLE_CALENDAR", "PROVIDER_VERIFIED"),
      check("PAYMENT", "PROVIDER_VERIFIED"),
    ]);

    expect(summary).toMatchObject({ overall: "PROVIDER_VERIFIED", providerVerifiedReady: true });
  });
});
