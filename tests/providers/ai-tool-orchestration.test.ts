import { describe, expect, test } from "vitest";
import { planAiToolOrchestration } from "../../src/server/ai/tool-orchestration";

const scope = {
  workspaceId: "ws-clearnest",
  allowedRequestIds: ["request-1"],
  allowedCustomerIds: ["customer-1"],
  handoverActive: false,
};

describe("AI tool orchestration guard", () => {
  test("limits model requested tools to six and requires facade-only execution", () => {
    const plan = planAiToolOrchestration({
      scope,
      requestedToolCalls: [
        { name: "getServiceCatalog", arguments: {} },
        { name: "searchApprovedKnowledge", arguments: { query: "move out" } },
        { name: "validateServiceArea", arguments: { area: "downtown" } },
        { name: "calculateQuote", arguments: { requestId: "request-1" } },
        { name: "findAvailableSlots", arguments: { requestId: "request-1" } },
        { name: "createQuoteDraft", arguments: { requestId: "request-1" } },
        { name: "getBusinessMetrics", arguments: {} },
      ],
    });

    expect(plan.accepted).toHaveLength(6);
    expect(plan.rejected).toMatchObject([{ reason: "TOOL_BUDGET_EXCEEDED" }]);
    expect(plan.accepted.every((tool) => tool.executionBoundary === "SERVICE_DESK_FACADE_ONLY")).toBe(true);
    expect(plan.businessMutationAllowed).toBe(false);
    expect(plan.privateReasoningStored).toBe(false);
  });

  test("blocks business-truth mutations and hallucinated cross-scope resources", () => {
    const plan = planAiToolOrchestration({
      scope,
      requestedToolCalls: [
        { name: "markPaymentPaid", arguments: { requestId: "request-1" } },
        { name: "calculateQuote", arguments: { requestId: "request-other" } },
        { name: "getCustomerBookingSummary", arguments: { customerId: "customer-other" } },
      ],
    });

    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected.map((item) => item.reason)).toEqual([
      "BUSINESS_TRUTH_TOOL_BLOCKED",
      "RESOURCE_OUT_OF_SCOPE",
      "RESOURCE_OUT_OF_SCOPE",
    ]);
    expect(plan.requiresHumanReview).toBe(true);
  });

  test("blocks automatic action while human handover is active", () => {
    const plan = planAiToolOrchestration({
      scope: { ...scope, handoverActive: true },
      requestedToolCalls: [
        { name: "proposeReschedule", arguments: { requestId: "request-1" } },
      ],
    });

    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected).toMatchObject([{ reason: "HANDOVER_ACTIVE" }]);
    expect(plan.requiresHumanReview).toBe(true);
  });

  test("rejects malformed tool arguments without executing anything", () => {
    const plan = planAiToolOrchestration({
      scope,
      requestedToolCalls: [
        { name: "calculateQuote", arguments: null },
        "not-a-tool-call",
      ],
    });

    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected.map((item) => item.reason)).toEqual(["SCHEMA_VIOLATION", "SCHEMA_VIOLATION"]);
  });

  test("finite proposal budget cannot be bypassed by NaN, Infinity or negative infinity", () => {
    const requests = Array.from({ length: 9 }, () => ({ name: "getServiceCatalog", arguments: {} }));
    for (const invalidBudget of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const plan = planAiToolOrchestration({ scope, requestedToolCalls: requests, maxToolCalls: invalidBudget });
      expect(plan.accepted).toHaveLength(0);
      expect(plan.rejected).toHaveLength(9);
      expect(plan.rejected.every(item => item.reason === "TOOL_BUDGET_EXCEEDED")).toBe(true);
      expect(plan.requiresHumanReview).toBe(true);
    }
    expect(planAiToolOrchestration({ scope, requestedToolCalls: requests, maxToolCalls: 2.7 }).accepted).toHaveLength(2);
    expect(planAiToolOrchestration({ scope, requestedToolCalls: requests, maxToolCalls: 100 }).accepted).toHaveLength(6);
  });

  test("rejects mistyped scope references even when matching scope lists are present", () => {
    const requestedToolCalls = [
      { name: "calculateQuote", arguments: { requestId: 5 } },
      { name: "calculateQuote", arguments: { requestId: null } },
      { name: "getCustomerBookingSummary", arguments: { customerId: ["customer-1"] } },
      { name: "getServiceCatalog", arguments: { workspaceId: 123 } },
      { name: "getServiceCatalog", arguments: { workspaceId: "" } },
      { name: "getServiceCatalog", arguments: { workspaceId: "other-workspace" } },
    ];
    const result = planAiToolOrchestration({ scope, requestedToolCalls });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected.map(item => item.reason)).toEqual(
      Array(requestedToolCalls.length).fill("RESOURCE_OUT_OF_SCOPE"),
    );
    expect(result.businessMutationAllowed).toBe(false);
  });

  test("never accepts a malformed call list or empty execution workspace", () => {
    const malformed = planAiToolOrchestration({
      scope,
      requestedToolCalls: { name: "getServiceCatalog" } as unknown as unknown[],
    });
    expect(malformed.accepted).toHaveLength(0);
    expect(malformed.rejected).toMatchObject([{ reason: "SCHEMA_VIOLATION" }]);
    expect(malformed.requiresHumanReview).toBe(true);

    const missingScope = planAiToolOrchestration({
      scope: { ...scope, workspaceId: " " },
      requestedToolCalls: [{ name: "getServiceCatalog", arguments: {} }],
    });
    expect(missingScope.accepted).toHaveLength(0);
    expect(missingScope.rejected).toMatchObject([{ reason: "RESOURCE_OUT_OF_SCOPE" }]);
  });

});
