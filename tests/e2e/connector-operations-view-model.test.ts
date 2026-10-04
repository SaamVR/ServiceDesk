import { describe, expect, it } from "vitest";
import { sampleIntegrations } from "../../src/features/operations/sample-data";
import {
  buildConnectorOperationsView,
  type ConnectorEvidenceSample,
} from "../../src/features/integrations/view-models";

const evidence: ConnectorEvidenceSample[] = [
  {
    stage: "WHATSAPP_INBOUND",
    label: "Inbound webhook",
    state: "OBSERVED_FIXTURE",
    detail: "Fixture webhook payload parsed into a sample conversation.",
  },
  {
    stage: "WHATSAPP_OUTBOUND_POLICY",
    label: "Outbound policy",
    state: "POLICY_ONLY",
    detail: "Template/session policy is displayed but no real message was sent.",
  },
  {
    stage: "WHATSAPP_STATUS",
    label: "Delivery status",
    state: "NO_PROVIDER_RECEIPT",
    detail: "Accepted, delivered and read must remain distinct.",
  },
  {
    stage: "CALENDAR",
    label: "Calendar",
    state: "NO_PROVIDER_RECEIPT",
    detail: "Fixture availability only.",
  },
  {
    stage: "PAYMENT",
    label: "Payment",
    state: "SANDBOX_ONLY",
    detail: "No verified production payment callback.",
  },
  {
    stage: "RECOVERY",
    label: "Recovery",
    state: "OBSERVED_FIXTURE",
    detail: "Recovery path is a UI sample only.",
  },
];

describe("connector operations UI model", () => {
  it("keeps the required connector sequence explicit", () => {
    const view = buildConnectorOperationsView({ integrations: sampleIntegrations, evidence });

    expect(view.steps.map((step) => step.stage)).toEqual([
      "WHATSAPP_INBOUND",
      "WHATSAPP_OUTBOUND_POLICY",
      "WHATSAPP_STATUS",
      "CALENDAR",
      "PAYMENT",
      "RECOVERY",
    ]);
  });

  it("never upgrades fixture or sandbox state to provider verified", () => {
    const view = buildConnectorOperationsView({ integrations: sampleIntegrations, evidence });

    expect(view.providerVerified).toBe(false);
    expect(view.releaseLabel).toBe("CONFIGURATION_BLOCKED");
    expect(view.steps.some((step) => step.proofLabel.includes("provider verified"))).toBe(false);
  });

  it("surfaces configured provider status separately from proof evidence", () => {
    const view = buildConnectorOperationsView({ integrations: sampleIntegrations, evidence });

    const calendar = view.steps.find((step) => step.stage === "CALENDAR");
    expect(calendar?.integrationStatus).toBe("DEGRADED · FIXTURE");

    const whatsapp = view.steps.find((step) => step.stage === "WHATSAPP_STATUS");
    expect(whatsapp?.integrationStatus).toBe("NOT CONFIGURED · FIXTURE");
  });
});
