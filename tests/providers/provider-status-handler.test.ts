import { describe, expect, test } from "vitest";
import { handleProviderStatus } from "../../src/server/api-handlers/provider-status";

describe("provider status handler", () => {
  test("rejects cross-workspace status reads", () => {
    const result = handleProviderStatus({
      actorWorkspaceId: "ws-other",
      workspaceId: "ws-clearnest",
      generatedAt: "2026-10-04T07:30:00.000Z",
      readiness: [],
      recovery: [],
      evidence: [],
    });

    expect(result.statusCode).toBe(403);
    expect(result.body).toContain("WORKSPACE_MISMATCH");
  });

  test("returns a redacted provider operations snapshot for the active workspace", () => {
    const result = handleProviderStatus({
      actorWorkspaceId: "ws-clearnest",
      workspaceId: "ws-clearnest",
      generatedAt: "2026-10-04T07:30:00.000Z",
      readiness: [
        { provider: "WHATSAPP", status: "CONFIGURATION_BLOCKED", missing: ["META_APP_SECRET"] },
        { provider: "PAYMENT", status: "CONTRACT_TESTED", missing: [] },
      ],
      recovery: [
        { provider: "PAYMENT", action: "OPERATOR_REVIEW", count: 2 },
        { provider: "WHATSAPP", action: "RETRY", count: 1 },
      ],
      evidence: [
        { provider: "PAYMENT", verification: "CONTRACT_TESTED", count: 3 },
      ],
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      workspaceId: "ws-clearnest",
      overallStatus: "CONFIGURATION_BLOCKED",
      recoveryQueueCount: 3,
      operatorReviewCount: 2,
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("token");
  });

  test("never marks a configured-but-unverified provider set as PROVIDER_VERIFIED", () => {
    const result = handleProviderStatus({
      actorWorkspaceId: "ws-clearnest",
      workspaceId: "ws-clearnest",
      generatedAt: "2026-10-04T07:30:00.000Z",
      readiness: [
        { provider: "WHATSAPP", status: "CONTRACT_TESTED", missing: [] },
        { provider: "GOOGLE_CALENDAR", status: "CONTRACT_TESTED", missing: [] },
      ],
      recovery: [],
      evidence: [],
    });

    const body = JSON.parse(result.body);
    expect(body.overallStatus).toBe("CONTRACT_TESTED");
  });
});
