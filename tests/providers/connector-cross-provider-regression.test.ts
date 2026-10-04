import { describe, expect, test } from "vitest";
import { classifyConnectorRegression, summarizeConnectorRegressionMatrix } from "../../src/server/integrations/closure/cross-provider-regression";

describe("connector cross-provider regression matrix", () => {
  test("keeps provider callbacks from mutating business truth directly", () => {
    const cases = [
      classifyConnectorRegression({ provider: "WHATSAPP", scenario: "duplicate_status", providerState: "DUPLICATE", attempts: 1, maxAttempts: 3 }),
      classifyConnectorRegression({ provider: "PAYMENT", scenario: "out_of_order_success", providerState: "OUT_OF_ORDER", attempts: 1, maxAttempts: 3 }),
      classifyConnectorRegression({ provider: "GOOGLE_CALENDAR", scenario: "stale_sync_token", providerState: "STALE_STATE", attempts: 1, maxAttempts: 3 }),
      classifyConnectorRegression({ provider: "WEBHOOK", scenario: "receiver_5xx", providerState: "TRANSIENT_FAILURE", attempts: 1, maxAttempts: 3 }),
      classifyConnectorRegression({ provider: "AI", scenario: "unsafe_tool_call", providerState: "PERMANENT_FAILURE", attempts: 1, maxAttempts: 3 }),
    ];

    expect(cases.every((entry) => entry.businessMutationAllowed === false)).toBe(true);
    expect(cases.map((entry) => entry.action)).toEqual(["ACK_DUPLICATE", "IGNORE_STALE", "RECONCILE", "RETRY", "OPERATOR_REVIEW"]);
  });

  test("summarizes blocked and retryable connector outcomes without provider verification claims", () => {
    const matrix = [
      classifyConnectorRegression({ provider: "PAYMENT", scenario: "checkout_rate_limit", providerState: "TRANSIENT_FAILURE", attempts: 2, maxAttempts: 3 }),
      classifyConnectorRegression({ provider: "EMAIL", scenario: "missing_api_key", providerState: "CONFIGURATION_BLOCKED", attempts: 0, maxAttempts: 3 }),
      classifyConnectorRegression({ provider: "WEBHOOK", scenario: "dead_letter", providerState: "TRANSIENT_FAILURE", attempts: 3, maxAttempts: 3 }),
    ];

    const summary = summarizeConnectorRegressionMatrix(matrix);
    expect(summary).toMatchObject({ total: 3, retryable: 1, blocked: 1, terminal: 2, providerVerifiedClaims: 0 });
    expect(summary.businessMutationAllowed).toBe(false);
  });
});
