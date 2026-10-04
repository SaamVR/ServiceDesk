import { describe, expect, it } from "vitest";
import { buildEditableRequestSummary } from "../../src/features/request-intake/view-models";
import { sampleQuote, sampleRequest } from "../../src/features/operations/sample-data";

describe("editable request summary view model", () => {
  it("summarizes frozen DTO request data and quote math without becoming business truth", () => {
    const view = buildEditableRequestSummary({ request: sampleRequest, quote: sampleQuote });

    expect(view.title).toBe("Move-out clean request");
    expect(view.versionLabel).toBe("Request v4 · Quote v2");
    expect(view.totalLabel).toBe("$340.00 total");
    expect(view.depositLabel).toBe("$85.00 deposit");
    expect(view.editableFields.map((field) => field.key)).toEqual(["service", "bedrooms", "bathrooms", "preferred_time"]);
    expect(view.boundaryNotice).toContain("updateRequest");
  });

  it("flags missing required intake fields before quote confirmation", () => {
    const view = buildEditableRequestSummary({
      request: { ...sampleRequest, bedrooms: undefined, bathrooms: undefined, requestedStartAt: undefined },
      quote: sampleQuote,
    });

    expect(view.missingFields).toEqual(["bedrooms", "bathrooms", "preferred_time"]);
    expect(view.confirmationBlocked).toBe(true);
    expect(view.primaryAction).toBe("Complete missing details");
  });
});
