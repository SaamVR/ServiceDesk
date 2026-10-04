import { describe, expect, it } from "vitest";
import {
  sampleAttentionItems,
  sampleIntegrations,
  sampleVisit,
} from "../../src/features/operations/sample-data";
import {
  buildRecoveryActionsView,
  type RecoveryFixture,
} from "../../src/features/recovery/view-models";

const recoveryFixtures: RecoveryFixture[] = [
  {
    id: "recovery_delivery_001",
    kind: "DELIVERY_UNCERTAIN",
    resourceId: "conv_showcase_001",
    state: "RECONCILE_REQUIRED",
    ownerUserId: "dispatcher_1",
    summary: "Provider accepted but recipient delivery is not proven.",
  },
  {
    id: "recovery_calendar_001",
    kind: "CALENDAR_STALE",
    resourceId: "slot_showcase_001",
    state: "RECONNECT_REQUIRED",
    ownerUserId: "dispatcher_1",
    summary: "Required calendar freshness is stale.",
  },
  {
    id: "recovery_payment_001",
    kind: "PAYMENT_REVIEW",
    resourceId: sampleVisit.id,
    state: "HUMAN_REVIEW_REQUIRED",
    ownerUserId: "dispatcher_1",
    summary: "Payment arrived after hold expiry; slot authority needs review.",
  },
];

describe("recovery actions UI model", () => {
  it("maps recovery conditions to explicit human-safe actions", () => {
    const view = buildRecoveryActionsView({
      attentionItems: sampleAttentionItems,
      integrations: sampleIntegrations,
      recoveryFixtures,
    });

    expect(view.items.map((item) => item.action)).toEqual([
      "Reconcile provider state before retry",
      "Reconnect or refresh calendar before confirmation",
      "Review payment and capacity before confirming visit",
    ]);
  });

  it("does not claim an uncertain send is safe to retry immediately", () => {
    const view = buildRecoveryActionsView({
      attentionItems: sampleAttentionItems,
      integrations: sampleIntegrations,
      recoveryFixtures,
    });

    const delivery = view.items.find((item) => item.kind === "DELIVERY_UNCERTAIN");
    expect(delivery?.canExecuteAutomatically).toBe(false);
    expect(delivery?.proofLabel).toBe("No provider delivery proof");
  });

  it("keeps recovery UI configuration blocked while integrations are fixture/degraded", () => {
    const view = buildRecoveryActionsView({
      attentionItems: sampleAttentionItems,
      integrations: sampleIntegrations,
      recoveryFixtures,
    });

    expect(view.releaseLabel).toBe("CONFIGURATION_BLOCKED");
  });
});
