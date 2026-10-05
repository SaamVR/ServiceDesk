import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const runtime = source("src/features/operations/operational-product-runtime.ts");
const route = source("src/features/operations/OperationalProductRoute.tsx");
const health = source("src/features/operations/integration-health-runtime.ts");

describe("V2 production settings integration health", () => {
  it("loads server-derived integration readiness into the operational snapshot", () => {
    expect(runtime).toContain("buildOperationalIntegrationHealth");
    expect(runtime).toContain("integrations: buildOperationalIntegrationHealth()");
    expect(health).toContain("buildV1ProviderReadinessRegistry");
    expect(health).toContain('source: report.provider === "PAYMENT" ? "INTERNAL_SANDBOX"');
  });

  it("replaces the disabled integration control with real readiness rows", () => {
    expect(route).toContain('id="integrations"');
    expect(route).toContain("data.integrations.map");
    expect(route).toContain("Sandbox ready");
    expect(route).toContain("Ready for proof");
    expect(route).toContain("Partial setup");
    expect(route).toContain("Setup required");
    expect(route).toContain("Configuration is not provider verification");
    expect(route).not.toContain('title="Integration status is not part of the current settings read."');
    expect(route).not.toContain(">Manage integrations</button>");
  });

  it("keeps secret values out of product data and payment explicitly sandbox-only", () => {
    expect(health).toContain("SERVER_CONFIGURATION_PRESENCE");
    expect(health).toContain("No live Stripe account or real-money charging is enabled.");
    expect(health).not.toContain("secretKey:");
    expect(route).toContain("Secret values are never exposed");
    expect(route).toContain("remain unverified until controlled external receipts are available");
  });
});
