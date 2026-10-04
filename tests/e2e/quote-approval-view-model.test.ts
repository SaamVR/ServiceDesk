import { describe, expect, it } from "vitest";
import { buildQuoteApprovalView } from "../../src/features/quotes/view-models";
import { sampleQuote, sampleRequest } from "../../src/features/operations/sample-data";

describe("staff quote approval model", () => {
  it("surfaces versioned quote comparison and human approval boundary", () => {
    const view = buildQuoteApprovalView({
      request: sampleRequest,
      currentQuote: sampleQuote,
      previousQuote: { ...sampleQuote, id: "quote_previous", version: 1, totalMinor: 31_000, depositMinor: 7_750, balanceMinor: 23_250, durationMinutes: 220 },
    });

    expect(view.requestLabel).toBe("MOVE_OUT · req_moveout_001");
    expect(view.versionLabel).toBe("Quote v2 compared with v1");
    expect(view.delta.totalDeltaLabel).toBe("+$30.00");
    expect(view.delta.durationDeltaLabel).toBe("+20m");
    expect(view.approvalBoundary).toContain("ServiceDeskFacade.sendQuote");
    expect(view.canAiApprove).toBe(false);
  });

  it("marks missing previous versions without fabricating comparison", () => {
    const view = buildQuoteApprovalView({ request: sampleRequest, currentQuote: sampleQuote });

    expect(view.versionLabel).toBe("Quote v2 has no previous fixture version");
    expect(view.delta.totalDeltaLabel).toBe("No comparison");
    expect(view.canAiApprove).toBe(false);
  });
});
