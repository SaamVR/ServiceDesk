import { describe, expect, it } from "vitest";
import { buildCrmCustomerView } from "../../src/features/crm/view-models";
import { sampleConversation, sampleInvoice, sampleQuote, sampleRequest, sampleVisit } from "../../src/features/operations/sample-data";

describe("staff CRM customer context view model", () => {
  it("groups request, quote, visit, invoice and conversation into one customer context", () => {
    const view = buildCrmCustomerView({
      request: sampleRequest,
      quote: sampleQuote,
      visit: sampleVisit,
      invoice: sampleInvoice,
      conversation: sampleConversation,
    });

    expect(view.customerLabel).toBe("Customer cust_sample");
    expect(view.propertyLabel).toBe("Property prop_sample");
    expect(view.requestSummary).toContain("MOVE_OUT");
    expect(view.financialSummary).toBe("$85.00 collected · $255.00 balance");
    expect(view.lastContactLabel).toContain("WHATSAPP");
  });

  it("keeps next actions operational and does not invent customer records", () => {
    const view = buildCrmCustomerView({
      request: sampleRequest,
      quote: sampleQuote,
      visit: sampleVisit,
      invoice: sampleInvoice,
      conversation: sampleConversation,
    });

    expect(view.source).toBe("DTO_SAMPLE");
    expect(view.nextActions).toContain("Review calendar freshness before confirming slot");
    expect(view.boundaryNotice).toContain("facade snapshot");
  });
});
