import { describe, expect, test } from "vitest";
import { buildConnectorClosureReport } from "../../src/server/integrations/closure/report";

describe("connector closure report", () => {
  test("keeps final connector status blocked until live provider evidence exists", () => {
    const report = buildConnectorClosureReport({
      branch: "feat/servicedesk-v1-connectors",
      startHead: "start",
      finalHead: "final",
      localTestsExecuted: false,
      runtimeBlockers: ["pnpm missing", "github DNS unavailable"],
      slices: [
        { name: "whatsapp", status: "CONTRACT_TESTED", providerVerified: false },
        { name: "calendar", status: "CONTRACT_TESTED", providerVerified: false },
        { name: "payments", status: "CONTRACT_TESTED", providerVerified: false },
        { name: "ai", status: "CONTRACT_TESTED", providerVerified: false },
      ],
    });

    expect(report.overallProviderStatus).toBe("CONFIGURATION_BLOCKED");
    expect(report.readyForControllerReview).toBe(true);
    expect(report.localTestsExecuted).toBe(false);
    expect(report.providerVerifiedClaims).toBe(0);
  });
});
