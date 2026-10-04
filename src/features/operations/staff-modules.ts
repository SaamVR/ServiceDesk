export type StaffModule =
  | "overview"
  | "inbox"
  | "customers"
  | "requests"
  | "quotes"
  | "schedule"
  | "jobs"
  | "invoices"
  | "quality"
  | "automations"
  | "reports"
  | "settings"
  | "billing";

export type StaffPrimarySurface =
  | "attention-overview"
  | "inbox"
  | "crm"
  | "request-summary"
  | "quote-approval"
  | "schedule"
  | "jobs"
  | "invoice-ledger"
  | "quality-review"
  | "recovery-actions"
  | "reports"
  | "owner-settings"
  | "platform-billing";

export const staffModuleConfig: Record<
  StaffModule,
  {
    label: string;
    group: "core" | "operations" | "settings";
    description: string;
    primarySurface: StaffPrimarySurface;
  }
> = {
  overview: {
    label: "Overview",
    group: "core",
    description: "Attention-first operational overview.",
    primarySurface: "attention-overview",
  },
  inbox: {
    label: "Inbox",
    group: "core",
    description: "Shared customer conversations, assignment and delivery state.",
    primarySurface: "inbox",
  },
  customers: {
    label: "Customers",
    group: "core",
    description: "Customer and property operational context.",
    primarySurface: "crm",
  },
  requests: {
    label: "Requests",
    group: "core",
    description: "Structured request intake and review state.",
    primarySurface: "request-summary",
  },
  quotes: {
    label: "Quotes",
    group: "core",
    description: "Versioned quote approval and current-version control.",
    primarySurface: "quote-approval",
  },
  schedule: {
    label: "Schedule",
    group: "core",
    description: "Crew capacity, holds, freshness and conflict review.",
    primarySurface: "schedule",
  },
  jobs: {
    label: "Jobs",
    group: "core",
    description: "Visit state, assignment and completion progress.",
    primarySurface: "jobs",
  },
  invoices: {
    label: "Invoices",
    group: "core",
    description: "Invoice allocation, balance and collection state.",
    primarySurface: "invoice-ledger",
  },
  quality: {
    label: "Quality",
    group: "operations",
    description: "Feedback, issue ownership, deadline and resolution.",
    primarySurface: "quality-review",
  },
  automations: {
    label: "Automations",
    group: "operations",
    description: "Queue evidence, suppression and owned recovery actions.",
    primarySurface: "recovery-actions",
  },
  reports: {
    label: "Reports",
    group: "operations",
    description: "Scoped conversion, collection and capacity reporting.",
    primarySurface: "reports",
  },
  settings: {
    label: "Settings",
    group: "settings",
    description: "Owner-controlled services, team and integration health.",
    primarySurface: "owner-settings",
  },
  billing: {
    label: "Billing",
    group: "settings",
    description: "Platform billing boundary separate from customer payments.",
    primarySurface: "platform-billing",
  },
};

export const staffNavigationGroups: Array<{
  label: string;
  modules: StaffModule[];
}> = [
  {
    label: "Core",
    modules: [
      "overview",
      "inbox",
      "customers",
      "requests",
      "quotes",
      "schedule",
      "jobs",
      "invoices",
    ],
  },
  {
    label: "Operations",
    modules: ["quality", "automations", "reports"],
  },
  {
    label: "Settings",
    modules: ["settings", "billing"],
  },
];

export function buildStaffModuleHref(workspaceSlug: string, module: StaffModule) {
  return `/app/${encodeURIComponent(workspaceSlug)}/${module}`;
}
