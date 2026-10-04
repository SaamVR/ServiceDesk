import { describe, expect, test } from "vitest";
import { classifyProviderRecovery, type ProviderRecoveryEvent } from "../../src/server/integrations/recovery/policy";

const providers = ["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK"] as const;

function event(overrides: Partial<ProviderRecoveryEvent> = {}): ProviderRecoveryEvent {
  return {
    provider: "WHATSAPP",
    operation: "OUTBOUND_SEND",
    status: "TRANSIENT_FAILURE",
    attempts: 0,
    maxAttempts: 3,
    occurredAt: "2026-10-04T06:45:00.000Z",
    idempotencyKey: "provider:event:1",
    redactedTarget: "target-redacted",
    ...overrides,
  };
}

describe("provider recovery classification matrix", () => {
  test("supports every provider without mutating business truth", () => {
    for (const provider of providers) {
      const decision = classifyProviderRecovery(event({ provider }));
      expect(decision).toMatchObject({ provider, action: "RETRY", retryable: true, mutatesBusinessTruth: false, preservesIdempotency: true });
      expect(decision.notes.join(" ")).toContain("idempotencyKey=provider:event:1");
    }
  });

  test("maps terminal and nonterminal statuses to stable actions", () => {
    expect(classifyProviderRecovery(event({ status: "DUPLICATE" }))).toMatchObject({ action: "ACK_DUPLICATE", terminal: true, retryable: false });
    expect(classifyProviderRecovery(event({ status: "OUT_OF_ORDER" }))).toMatchObject({ action: "IGNORE_STALE", terminal: true, retryable: false });
    expect(classifyProviderRecovery(event({ status: "STALE_STATE" }))).toMatchObject({ action: "RECONCILE", terminal: false, retryable: false });
    expect(classifyProviderRecovery(event({ status: "CONFIGURATION_BLOCKED" }))).toMatchObject({ action: "BLOCKED_CONFIGURATION", terminal: true, retryable: false });
    expect(classifyProviderRecovery(event({ status: "PERMANENT_FAILURE" }))).toMatchObject({ action: "DEAD_LETTER", terminal: true, retryable: false });
  });

  test("stops transient retry exactly when next failed attempt reaches budget", () => {
    expect(classifyProviderRecovery(event({ attempts: 2, maxAttempts: 3 }))).toMatchObject({ action: "OPERATOR_REVIEW", terminal: true, retryable: false });
  });
});
