import { describe, expect, test } from "vitest";
import { buildConnectorHandoffSummary } from "../../src/server/integrations/handoff/summary";

describe("connector controller handoff summary", () => {
  test("reports implemented connector slices without overstating provider proof", () => {
    const summary = buildConnectorHandoffSummary({
      branch: "feat/servicedesk-v1-connectors",
      head: "abc123",
      generatedAt: "2026-10-04T06:50:00.000Z",
      slices: [
        { name: "whatsapp-inbound", status: "IMPLEMENTED" },
        { name: "calendar-reconciliation", status: "IMPLEMENTED" },
        { name: "payment-review", status: "IMPLEMENTED" },
      ],
      providerEvidence: [
        { provider: "WHATSAPP", verification: "CONFIGURATION_BLOCKED" },
        { provider: "GOOGLE_CALENDAR", verification: "CONTRACT_TESTED" },
        { provider: "PAYMENT", verification: "CONTRACT_TESTED" },
      ],
      testExecution: {
        focusedTestsRun: 0,
        focusedTestsPassed: 0,
        blockedReason: "pnpm unavailable in runtime",
      },
      integrationOnlyFiles: ["src/server/integrations/index.ts", "src/server/api-handlers/index.ts"],
    });

    expect(summary.completionLabel).toBe("IMPLEMENTED");
    expect(summary.providerVerified).toBe(false);
    expect(summary.configurationBlockedProviders).toEqual(["WHATSAPP"]);
    expect(summary.tests).toMatchObject({ run: 0, passed: 0, blocked: true });
    expect(summary.integrationOnlyFiles).toHaveLength(2);
  });

  test("only reports provider verified when every listed provider has controlled proof", () => {
    const summary = buildConnectorHandoffSummary({
      branch: "feat/servicedesk-v1-connectors",
      head: "verified123",
      generatedAt: "2026-10-04T06:50:00.000Z",
      slices: [{ name: "controlled-proof", status: "PROVIDER_VERIFIED" }],
      providerEvidence: [
        { provider: "WHATSAPP", verification: "PROVIDER_VERIFIED" },
        { provider: "GOOGLE_CALENDAR", verification: "PROVIDER_VERIFIED" },
      ],
      testExecution: { focusedTestsRun: 8, focusedTestsPassed: 8 },
      integrationOnlyFiles: [],
    });

    expect(summary.completionLabel).toBe("PROVIDER_VERIFIED");
    expect(summary.providerVerified).toBe(true);
  });
});
