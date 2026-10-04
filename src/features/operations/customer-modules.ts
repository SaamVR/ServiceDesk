export type CustomerModule =
  | "overview"
  | "properties"
  | "quote"
  | "booking"
  | "invoice"
  | "preferences";

export type CustomerPrimarySurface =
  | "portal-overview"
  | "property-recurring"
  | "quote-current"
  | "checkout-state"
  | "invoice-ledger"
  | "communication-preferences";

export const customerModuleConfig: Record<
  CustomerModule,
  {
    label: string;
    description: string;
    primarySurface: CustomerPrimarySurface;
  }
> = {
  overview: {
    label: "Portal",
    description: "Customer-scoped summary of quote, booking and invoice state.",
    primarySurface: "portal-overview",
  },
  properties: {
    label: "Properties",
    description: "Property and recurring-visit preferences.",
    primarySurface: "property-recurring",
  },
  quote: {
    label: "Quote",
    description: "Current quote version, validity and acceptance boundary.",
    primarySurface: "quote-current",
  },
  booking: {
    label: "Booking",
    description: "Slot hold, payment state, Calendar freshness and visit confirmation.",
    primarySurface: "checkout-state",
  },
  invoice: {
    label: "Invoice",
    description: "Invoice allocation, balance and receipt visibility boundary.",
    primarySurface: "invoice-ledger",
  },
  preferences: {
    label: "Preferences",
    description: "Communication channel, consent and provider availability.",
    primarySurface: "communication-preferences",
  },
};

export const customerNavigation: Array<{
  module: CustomerModule;
  label: string;
}> = [
  { module: "overview", label: customerModuleConfig.overview.label },
  { module: "properties", label: customerModuleConfig.properties.label },
  { module: "quote", label: customerModuleConfig.quote.label },
  { module: "booking", label: customerModuleConfig.booking.label },
  { module: "invoice", label: customerModuleConfig.invoice.label },
  { module: "preferences", label: customerModuleConfig.preferences.label },
];

export function buildCustomerModuleHref(
  module: CustomerModule,
  ids: { quoteId?: string; bookingId?: string; invoiceId?: string },
) {
  switch (module) {
    case "overview":
      return "/portal";
    case "properties":
      return "/portal/properties";
    case "quote":
      return `/portal/quotes/${encodeURIComponent(ids.quoteId ?? "quote_moveout_001")}`;
    case "booking":
      return `/portal/bookings/${encodeURIComponent(ids.bookingId ?? "visit_showcase_001")}`;
    case "invoice":
      return `/portal/invoices/${encodeURIComponent(ids.invoiceId ?? "invoice_showcase_001")}`;
    case "preferences":
      return "/portal/preferences";
  }
}
