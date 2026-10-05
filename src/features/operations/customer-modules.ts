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
    description: "Summary of your quotes, bookings and invoices.",
    primarySurface: "portal-overview",
  },
  properties: {
    label: "Properties",
    description: "Properties and recurring service preferences.",
    primarySurface: "property-recurring",
  },
  quote: {
    label: "Quote",
    description: "Current quote, validity and acceptance status.",
    primarySurface: "quote-current",
  },
  booking: {
    label: "Booking",
    description: "Booking time, payment status and visit confirmation.",
    primarySurface: "checkout-state",
  },
  invoice: {
    label: "Invoice",
    description: "Invoice balance, payment allocation and receipt status.",
    primarySurface: "invoice-ledger",
  },
  preferences: {
    label: "Preferences",
    description: "Saved communication preferences and consent status.",
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
