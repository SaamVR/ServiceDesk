export type ProductRouteKey = "enquiry" | "quote" | "schedule" | "checkout" | "portal" | "staff" | "crew";

export interface ProductServerDependency {
  command: string;
  status: "ACCEPTED_E02" | "FUTURE_E03" | "FUTURE_E05" | "FUTURE_E06";
  productAdapter: string;
  enabledInProduct: boolean;
  reason: string;
}

export interface ProductRouteServerBoundary {
  route: ProductRouteKey;
  routeFamily: string[];
  dependencies: ProductServerDependency[];
  fixtureWrapper: string;
}

export const productRouteServerBoundaries: ProductRouteServerBoundary[] = [
  {
    route: "enquiry",
    routeFamily: ["/b/[slug]/enquire"],
    fixtureWrapper: "OperationalFixtureRoute",
    dependencies: [
      { command: "createRequest", status: "ACCEPTED_E02", productAdapter: "createBusinessEnquiryServerActionFactory", enabledInProduct: false, reason: "Wired only through dependency injection after server entrypoint import is accepted." },
      { command: "updateRequest", status: "ACCEPTED_E02", productAdapter: "createBusinessEnquiryServerActionFactory", enabledInProduct: false, reason: "Version conflict and workspace/auth failures must propagate from Core." },
      { command: "calculateQuote", status: "ACCEPTED_E02", productAdapter: "createBusinessEnquiryServerActionFactory", enabledInProduct: false, reason: "Product must not calculate quote totals client-side." },
    ],
  },
  {
    route: "quote",
    routeFamily: ["/app/[workspace]/quotes", "/portal/quotes/[id]"],
    fixtureWrapper: "OperationalFixtureRoute",
    dependencies: [
      { command: "sendQuote", status: "ACCEPTED_E02", productAdapter: "createSendQuoteServerActionFactory", enabledInProduct: false, reason: "Outbound enqueue/provider delivery proof remains outside Product." },
    ],
  },
  {
    route: "schedule",
    routeFamily: ["/app/[workspace]/schedule"],
    fixtureWrapper: "OperationalFixtureRoute",
    dependencies: [
      { command: "findSlots", status: "ACCEPTED_E02", productAdapter: "createScheduleServerActionFactory.findSlots", enabledInProduct: false, reason: "Calendar/provider access is not called from Product." },
      { command: "holdSlot", status: "ACCEPTED_E02", productAdapter: "createScheduleServerActionFactory.holdSlot", enabledInProduct: false, reason: "Slot/hold errors stay server authoritative." },
    ],
  },
  {
    route: "checkout",
    routeFamily: ["/b/[slug]/book", "/portal/bookings/[id]"],
    fixtureWrapper: "OperationalFixtureRoute",
    dependencies: [
      { command: "future E03 payment bridge", status: "FUTURE_E03", productAdapter: "not-created", enabledInProduct: false, reason: "Hosted checkout remains disabled until verified payment boundary exists." },
    ],
  },
  {
    route: "portal",
    routeFamily: ["/portal", "/portal/properties", "/portal/preferences", "/portal/invoices/[id]"],
    fixtureWrapper: "OperationalFixtureRoute",
    dependencies: [
      { command: "readWorkspaceSnapshot", status: "FUTURE_E05", productAdapter: "not-created", enabledInProduct: false, reason: "Durable inbox/snapshot read model is not complete." },
      { command: "readPropertySnapshot", status: "ACCEPTED_E02", productAdapter: "not-created", enabledInProduct: false, reason: "Route composition waits for coordinator-approved server import boundary." },
    ],
  },
  {
    route: "staff",
    routeFamily: [
      "/app/[workspace]/overview",
      "/app/[workspace]/inbox",
      "/app/[workspace]/customers",
      "/app/[workspace]/requests",
      "/app/[workspace]/quotes",
      "/app/[workspace]/schedule",
      "/app/[workspace]/jobs",
      "/app/[workspace]/invoices",
      "/app/[workspace]/reports",
      "/app/[workspace]/billing",
      "/app/[workspace]/quality",
      "/app/[workspace]/automations",
      "/app/[workspace]/settings",
    ],
    fixtureWrapper: "OperationalFixtureRoute",
    dependencies: [
      { command: "readStaffWorkspaceSnapshot", status: "FUTURE_E05", productAdapter: "not-created", enabledInProduct: false, reason: "Staff dashboard modules remain fixture-labelled until the durable read model exists." },
    ],
  },
  {
    route: "crew",
    routeFamily: ["/crew/today", "/crew/jobs/[id]"],
    fixtureWrapper: "OperationalFixtureRoute",
    dependencies: [
      { command: "transitionVisit", status: "FUTURE_E06", productAdapter: "not-created", enabledInProduct: false, reason: "Crew mutation buttons stay disabled until authorized field transition persistence is accepted." },
    ],
  },
];
