import { describe, expect, it } from "vitest";
import type { PlatformBillingSnapshotDTO } from "../../src/contracts";
import { buildPlatformBillingView } from "../../src/features/billing/view-models";
import { sampleInvoice } from "../../src/features/operations/sample-data";

const snapshot: PlatformBillingSnapshotDTO = {
  workspaceId: "ws_showcase",
  subscription: {
    workspaceId: "ws_showcase",
    plan: "TRIAL",
    status: "TRIALING",
    providerMode: "SANDBOX",
    trialEndsAt: "2026-11-01T00:00:00.000Z",
    version: 1,
    updatedAt: "2026-10-04T06:00:00.000Z",
  },
  usage: [{ metric: "AI_ACTIONS", used: 12, limit: 100, state: "WITHIN_LIMIT" }],
};

describe("platform billing UI boundary", () => {
  it("keeps platform subscription state separate from customer cleaning invoice state", () => {
    const view = buildPlatformBillingView(snapshot, sampleInvoice);
    expect(view.planLabel).toBe("TRIAL");
    expect(view.customerInvoiceLabel).toContain("PARTIALLY PAID");
    expect(view.boundaryNotice).toContain("separate");
  });

  it("does not claim live subscription billing from sandbox mode", () => {
    const view = buildPlatformBillingView(snapshot, sampleInvoice);
    expect(view.releaseLabel).toBe("CONFIGURATION_BLOCKED");
    expect(view.modeLabel).toBe("SANDBOX");
  });
});
