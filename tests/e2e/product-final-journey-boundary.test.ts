import { describe, expect, it } from "vitest";
import { finalErrorRecoveryMatrix, finalGuidedV1Journey, finalRoleRouteMatrix } from "@/features/product/final-journey-model";

describe("E10 final Product journey model", () => {
  it("covers the implemented V1 route families", () => {
    expect(finalGuidedV1Journey.map((step) => step.id)).toEqual(expect.arrayContaining(["public-enquiry", "inbox", "crew-job", "invoice-manual-payment", "quality", "recovery", "reports", "platform-billing", "settings", "onboarding"]));
  });
  it("keeps customer, crew, dispatcher and owner controls separated", () => {
    expect(finalRoleRouteMatrix.map((item) => item.role)).toEqual(["visitor", "customer", "crew", "dispatcher", "owner"]);
    expect(finalRoleRouteMatrix.find((item) => item.role === "customer")?.blocked).toContain("staff manual payment");
    expect(finalRoleRouteMatrix.find((item) => item.role === "crew")?.blocked).toContain("platform billing");
  });
  it("requires non-optimistic recovery for known V1 errors", () => {
    expect(finalErrorRecoveryMatrix.every((item) => item.optimisticMutation === false)).toBe(true);
  });
});
