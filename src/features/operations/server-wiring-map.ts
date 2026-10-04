export type V1ProductRouteKey = "enquiry" | "quote" | "schedule" | "checkout" | "portal" | "crew";

export type V1ProductDependencyState = "BLOCKED_PENDING_WORKER1_ENTRYPOINTS" | "BLOCKED_PENDING_E03_PAYMENT_BRIDGE" | "READY_FOR_FUTURE_WIRING";

export interface V1ProductServerWiringDependency {
  route: V1ProductRouteKey;
  routePatterns: string[];
  requiredServerBoundaries: string[];
  state: V1ProductDependencyState;
  notes: string;
}

export const v1ProductServerWiringMap: Record<V1ProductRouteKey, V1ProductServerWiringDependency> = {
  enquiry: {
    route: "enquiry",
    routePatterns: ["/b/[slug]/enquire"],
    requiredServerBoundaries: ["createRequest", "updateRequest", "calculateQuote"],
    state: "BLOCKED_PENDING_WORKER1_ENTRYPOINTS",
    notes: "Public request intake must stay preview-only until Worker 1 exposes accepted request composition entrypoints.",
  },
  quote: {
    route: "quote",
    routePatterns: ["/portal/quote", "/app/[workspace]/quotes"],
    requiredServerBoundaries: ["sendQuote"],
    state: "BLOCKED_PENDING_WORKER1_ENTRYPOINTS",
    notes: "Quote preview can render DTO props now; customer send remains staff/server-authorized.",
  },
  schedule: {
    route: "schedule",
    routePatterns: ["/app/[workspace]/schedule"],
    requiredServerBoundaries: ["findSlots", "holdSlot"],
    state: "BLOCKED_PENDING_WORKER1_ENTRYPOINTS",
    notes: "Schedule UI can consume slot/integration/attention DTO props but cannot reserve capacity locally.",
  },
  checkout: {
    route: "checkout",
    routePatterns: ["/b/[slug]/book", "/portal/booking"],
    requiredServerBoundaries: ["future E03 payment bridge"],
    state: "BLOCKED_PENDING_E03_PAYMENT_BRIDGE",
    notes: "Checkout UI stays receipt-fail-safe and disabled until the verified payment bridge is accepted.",
  },
  portal: {
    route: "portal",
    routePatterns: ["/portal", "/portal/properties", "/portal/preferences", "/portal/invoice"],
    requiredServerBoundaries: ["future readWorkspaceSnapshot", "future property reads"],
    state: "BLOCKED_PENDING_WORKER1_ENTRYPOINTS",
    notes: "Portal surfaces need authoritative workspace/customer/property snapshots before replacing fixture wrappers.",
  },
  crew: {
    route: "crew",
    routePatterns: ["/crew/today", "/crew/job/[visitId]"],
    requiredServerBoundaries: ["future transitionVisit"],
    state: "BLOCKED_PENDING_WORKER1_ENTRYPOINTS",
    notes: "Crew job UI can render request/visit/invoice DTO props, but transitions and evidence persistence remain server-owned.",
  },
};

export const v1ProductReadyNext = "wire enquiry/quote/schedule to accepted Worker 1 entrypoints" as const;
