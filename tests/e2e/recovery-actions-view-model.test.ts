import { describe, expect, it } from "vitest";
import { sampleAttentionItems, sampleIntegrations } from "../../src/features/operations/sample-data";
import { buildRecoveryActionsView } from "../../src/features/recovery/view-models";

describe("recovery actions UI model", () => {
  it("maps persisted attention conditions to explicit human-safe actions", () => {
    const view = buildRecoveryActionsView({ attentionItems: sampleAttentionItems, integrations: sampleIntegrations });
    expect(view.items.map((item) => item.action)).toEqual([
      "Reconnect or refresh calendar before confirmation",
      "Reconcile provider state before retry",
      "Review payment and capacity before confirming visit",
      "Human staff must review invoice/payment state",
    ]);
  });

  it("does not claim an uncertain send is safe to retry immediately", () => {
    const view = buildRecoveryActionsView({ attentionItems: sampleAttentionItems, integrations: sampleIntegrations });
    const delivery = view.items.find((item) => item.kind === "DELIVERY_UNCERTAIN");
    expect(delivery?.canExecuteAutomatically).toBe(false);
    expect(delivery?.proofLabel).toBe("No provider delivery proof");
  });

  it("keeps recovery UI configuration blocked while integrations are fixture/degraded", () => {
    const view = buildRecoveryActionsView({ attentionItems: sampleAttentionItems, integrations: sampleIntegrations });
    expect(view.releaseLabel).toBe("CONFIGURATION_BLOCKED");
  });
});
