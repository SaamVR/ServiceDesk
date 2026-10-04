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

export const staffModuleConfig: Record<
  StaffModule,
  {
    label: string;
    group: "core" | "operations" | "settings";
    description: string;
  }
> = {
  overview: {
    label: "Overview",
    group: "core",
    description: "Attention-first operational overview.",
  },
  inbox: {
    label: "Inbox",
    group: "core",
    description: "Shared customer conversations, assignment and delivery state.",
  },
  customers: {
    label: "Customers",
    group: "core",
    description: "Customer and property operational context.",
  },
  requests: {
    label: "Requests",
    group: "core",
    description: "Structured request intake and review state.",
  },
  quotes: {
    label: "Quotes",
    group: "core",
    description: "Versioned quote approval and current-version control.",
  },
  schedule: {
    label: "Schedule",
    group: "core",
    description: "Crew capacity, holds, freshness and conflict review.",
  },
  jobs: {
    label: "Jobs",
    group: "core",
    description: "Visit state, assignment and completion progress.",
  },
  invoices: {
    label: "Invoices",
    group: "core",
    description: "Invoice allocation, balance and collection state.",
  },
  quality: {
    label: "Quality",
    group: "operations",
    description: "Feedback, issue ownership, deadline and resolution.",
  },
  automations: {
    label: "Automations",
    group: "operations",
    description: "Queue evidence, suppression and owned recovery actions.",
  },
  reports: {
    label: "Reports",
    group: "operations",
    description: "Scoped conversion, collection and capacity reporting.",
  },
  settings: {
    label: "Settings",
    group: "settings",
    description: "Owner-controlled services, team and integration health.",
  },
  billing: {
    label: "Billing",
    group: "settings",
    description: "Platform billing boundary separate from customer payments.",
  },
};
