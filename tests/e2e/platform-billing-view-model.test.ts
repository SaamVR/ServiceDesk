import { describe, expect, it } from "vitest";
import { sampleInvoice } from "../../src/features/operations/sample-data";
import {
  buildPlatformBillingView,
  type PlatformPlanFixture,
} from "../../src/features/billing/view-models";

const plan: PlatformPlanFixture = {
  planCode: "V1_TRIAL",
  state: "TRIAL",
  renewalAt: "2026-11-01T00:00:00.000Z",
  providerMode: "SANDBOX",
};

describe("platform billing UI boundary", () => {
  it("keeps platform plan state separate from customer cleaning invoice state", () => {
    const view = buildPlatformBillingView({ plan, customerInvoice: sampleInvoice });

    expect(view.platformPlanLabel).toContain("V1_TRIAL");
    expect(view.customerPaymentLabel).toContain("PARTIALLY PAID");
    expect(view.boundaryNotice).toContain("separate");
  });

  it("does not claim live subscription billing from a fixture or sandbox plan", () => {
    const view = buildPlatformBillingView({ plan, customerInvoice: sampleInvoice });

    expect(view.releaseLabel).toBe("CONFIGURATION_BLOCKED");
    expect(view.dataSource).toBe("FIXTURE_UI_ONLY");
  });
});
