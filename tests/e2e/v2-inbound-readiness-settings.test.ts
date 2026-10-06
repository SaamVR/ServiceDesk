import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/integration-health-runtime.ts"),
  "utf8",
);
const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);

describe("V2 inbound readiness Settings product", () => {
  it("models Email inbound and Voice inbound as separate integration health entries", () => {
    expect(runtime).toContain('"EMAIL_INBOUND"');
    expect(runtime).toContain('"VOICE_INBOUND"');
    expect(runtime).toContain('"Email inbound"');
    expect(runtime).toContain('"Voice inbound"');
  });

  it("checks only configuration presence and never serializes secret values", () => {
    expect(runtime).toContain("SERVICEDESK_EMAIL_WEBHOOK_SECRET");
    expect(runtime).toContain("SERVICEDESK_VOICE_WEBHOOK_SECRET");
    expect(runtime).toContain("PROVIDER_ACCOUNT_WORKSPACE_MAP");
    expect(runtime).not.toMatch(/webhookSecret\s*:/);
    expect(runtime).not.toMatch(/serviceRoleKey\s*:/);
  });

  it("uses the existing credential-safe Settings integration grid", () => {
    expect(route).toContain("Connection readiness and verification status without exposing credentials.");
    expect(route).toContain("data.integrations.map");
    expect(route).toContain("Secret values are never exposed.");
  });

  it("renders provider-verified evidence distinctly from configuration readiness", () => {
    expect(route).toContain('integration.verificationState === "PROVIDER_VERIFIED"');
    expect(route).toContain('"Provider verified"');
    expect(route).toContain('"success" as const');
  });

});
