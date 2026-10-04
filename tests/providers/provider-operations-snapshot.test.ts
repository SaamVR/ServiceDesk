import { describe, expect, test } from "vitest";
import { buildProviderOperationsSnapshot } from "../../src/server/integrations/operations/snapshot";

describe("provider operations snapshot", () => {
  test("summarizes readiness and recovery without leaking sensitive data", () => {
    const snapshot = buildProviderOperationsSnapshot({
      workspaceId: "ws-clearnest",
      generatedAt: "2026-10-04T10:00:00.000Z",
      readiness: [
        { provider: "WHATSAPP", status: "CONFIGURATION_BLOCKED", missing: ["meta_app_secret", "controlled_recipient"] },
        { provider: "GOOGLE_CALENDAR", status: "CONTRACT_TESTED", missing: [] },
        { provider: "PAYMENT", status: "PROVIDER_VERIFIED", missing: [] },
      ],
      recovery: [
        { provider: "WHATSAPP", action: "RETRY", count: 2 },
        { provider: "PAYMENT", action: "OPERATOR_REVIEW", count: 1 },
      ],
      evidence: [
        { provider: "WHATSAPP", verification: "CONFIGURATION_BLOCKED", count: 1 },
        { provider: "PAYMENT", verification: "PROVIDER_VERIFIED", count: 2 },
      ],
    });

    expect(snapshot).toEqual({
      workspaceId: "ws-clearnest",
      generatedAt: "2026-10-04T10:00:00.000Z",
      overallStatus: "CONFIGURATION_BLOCKED",
      providerCount: 3,
      blockedProviders: ["WHATSAPP"],
      providerVerifiedCount: 1,
      contractTestedCount: 1,
      recoveryQueueCount: 3,
      operatorReviewCount: 1,
      evidenceCounts: {
        CONFIGURATION_BLOCKED: 1,
        CONTRACT_TESTED: 0,
        PROVIDER_VERIFIED: 2,
      },
      notes: ["1 provider(s) still blocked by missing configuration.", "1 recovery item(s) require operator review."],
    });
  });

  test("marks snapshot provider verified only when every provider is verified", () => {
    const snapshot = buildProviderOperationsSnapshot({
      workspaceId: "ws-clearnest",
      generatedAt: "2026-10-04T10:00:00.000Z",
      readiness: [
        { provider: "WHATSAPP", status: "PROVIDER_VERIFIED", missing: [] },
        { provider: "PAYMENT", status: "PROVIDER_VERIFIED", missing: [] },
      ],
      recovery: [],
      evidence: [],
    });

    expect(snapshot.overallStatus).toBe("PROVIDER_VERIFIED");
    expect(snapshot.notes).toContain("All listed providers are provider-verified.");
  });

  test("keeps contract-tested when no provider is blocked but not all are verified", () => {
    const snapshot = buildProviderOperationsSnapshot({
      workspaceId: "ws-clearnest",
      generatedAt: "2026-10-04T10:00:00.000Z",
      readiness: [
        { provider: "WHATSAPP", status: "CONTRACT_TESTED", missing: [] },
        { provider: "PAYMENT", status: "PROVIDER_VERIFIED", missing: [] },
      ],
      recovery: [],
      evidence: [],
    });

    expect(snapshot.overallStatus).toBe("CONTRACT_TESTED");
  });
});
