import { describe, expect, test } from "vitest";
import { buildOwnerIntelligenceDigest, evaluateSubscriptionEntitlement } from "../../src/server/integrations/subscription/adapter";

describe("subscription and owner intelligence adapter", () => {
  test("allows active growth subscription to use AI and integrations", () => {
    const gate = evaluateSubscriptionEntitlement({
      workspaceId: "ws-clearnest",
      plan: "GROWTH",
      status: "ACTIVE",
      now: "2026-10-04T09:00:00.000Z",
      currentPeriodEndsAt: "2026-11-04T09:00:00.000Z",
    });

    expect(gate).toMatchObject({ state: "ALLOW", aiEnabled: true, integrationsEnabled: true, ownerInsightsEnabled: true });
  });

  test("degrades past-due account while preserving read-only owner insight", () => {
    const gate = evaluateSubscriptionEntitlement({
      workspaceId: "ws-clearnest",
      plan: "STARTER",
      status: "PAST_DUE",
      now: "2026-10-04T09:00:00.000Z",
      currentPeriodEndsAt: "2026-10-05T09:00:00.000Z",
    });

    expect(gate).toMatchObject({ state: "DEGRADED", aiEnabled: false, integrationsEnabled: false, ownerInsightsEnabled: true, reason: "PAYMENT_PAST_DUE" });
  });

  test("blocks cancelled subscription without mutating billing truth", () => {
    const gate = evaluateSubscriptionEntitlement({
      workspaceId: "ws-clearnest",
      plan: "STARTER",
      status: "CANCELLED",
      now: "2026-10-04T09:00:00.000Z",
    });

    expect(gate).toMatchObject({ state: "BLOCK", aiEnabled: false, integrationsEnabled: false, billingMutationAllowed: false });
  });

  test("builds redacted owner intelligence digest from aggregate operational signals", () => {
    const digest = buildOwnerIntelligenceDigest({
      workspaceId: "ws-clearnest",
      generatedAt: "2026-10-04T09:00:00.000Z",
      aggregates: {
        openRequests: 14,
        unansweredConversations: 5,
        overdueInvoicesMinor: 125000,
        crewCapacityMinutes: 240,
        bookedServiceMinutes: 420,
      },
      samples: ["Ada Lovelace <ada@example.test>", "customer phone +15551234567"],
    });

    expect(digest.cards.map((card) => card.type)).toEqual(expect.arrayContaining(["ATTENTION_QUEUE", "PAYMENT_RISK", "CAPACITY_RISK"]));
    expect(JSON.stringify(digest)).not.toContain("Ada");
    expect(JSON.stringify(digest)).not.toContain("ada@example.test");
    expect(JSON.stringify(digest)).not.toContain("+15551234567");
  });
});
