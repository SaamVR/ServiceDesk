import { describe, expect, test } from "vitest";
import { guardAiModelOutput } from "../../src/server/ai/output-guard";

describe("AI business truth guard", () => {
  test("rejects model-authored price payment role capacity and delivery truth", () => {
    for (const forbidden of [
      { totalMinor: 34000 },
      { depositMinor: 8500 },
      { paymentStatus: "PAID" },
      { role: "OWNER" },
      { availabilityConfirmed: true },
      { deliveryStatus: "DELIVERED" },
      { providerVerified: true },
    ]) {
      expect(guardAiModelOutput({ corrections: [], unsupportedReasons: [], riskFlags: [], ...forbidden })).toMatchObject({
        ok: false,
        code: "AI_BUSINESS_TRUTH_FORBIDDEN",
      });
    }
  });
});
