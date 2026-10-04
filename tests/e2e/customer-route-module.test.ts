import { describe, expect, it } from "vitest";
import {
  buildCustomerModuleHref,
  customerModuleConfig,
  customerNavigation,
} from "../../src/features/operations/customer-modules";

describe("customer portal module map", () => {
  it("maps every customer portal route to one primary surface", () => {
    expect(Object.keys(customerModuleConfig)).toEqual([
      "overview",
      "properties",
      "quote",
      "booking",
      "invoice",
      "preferences",
    ]);

    expect(customerModuleConfig.properties.primarySurface).toBe("property-recurring");
    expect(customerModuleConfig.quote.primarySurface).toBe("quote-current");
    expect(customerModuleConfig.booking.primarySurface).toBe("checkout-state");
    expect(customerModuleConfig.invoice.primarySurface).toBe("invoice-ledger");
    expect(customerModuleConfig.preferences.primarySurface).toBe("communication-preferences");
  });

  it("keeps customer navigation scoped to portal URLs", () => {
    expect(customerNavigation.map((item) => item.module)).toEqual([
      "overview",
      "properties",
      "quote",
      "booking",
      "invoice",
      "preferences",
    ]);

    expect(buildCustomerModuleHref("overview", {})).toBe("/portal");
    expect(buildCustomerModuleHref("properties", {})).toBe("/portal/properties");
    expect(buildCustomerModuleHref("quote", { quoteId: "quote_1" })).toBe("/portal/quotes/quote_1");
    expect(buildCustomerModuleHref("booking", { bookingId: "visit_1" })).toBe("/portal/bookings/visit_1");
    expect(buildCustomerModuleHref("invoice", { invoiceId: "invoice_1" })).toBe("/portal/invoices/invoice_1");
  });
});
