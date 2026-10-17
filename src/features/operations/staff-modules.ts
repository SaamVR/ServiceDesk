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
  | "ai-studio"
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
  | "ai-studio"
  | "reports"
  | "owner-settings"
  | "platform-billing";

export const staffModuleConfig: Record<
  StaffModule,
  {
    label: string;
    group: "core" | "operations" | "settings";
    eyebrow: string;
    description: string;
    primarySurface: StaffPrimarySurface;
  }
> = {
  overview: {
    label: "Overview",
    group: "core",
    eyebrow: "Operations",
    description: "Today’s workload, priority items, pipeline, and collections.",
    primarySurface: "attention-overview",
  },
  inbox: {
    label: "Inbox",
    group: "core",
    eyebrow: "Customer communications",
    description: "Customer conversations, ownership, handover, and delivery status.",
    primarySurface: "inbox",
  },
  customers: {
    label: "Customers",
    group: "core",
    eyebrow: "CRM",
    description: "Customer profiles, properties, and service history.",
    primarySurface: "crm",
  },
  requests: {
    label: "Requests",
    group: "core",
    eyebrow: "Sales pipeline",
    description: "Review incoming service requests and move them toward a quote.",
    primarySurface: "request-summary",
  },
  quotes: {
    label: "Quotes",
    group: "core",
    eyebrow: "Sales pipeline",
    description: "Prepare, send, and track customer quotes and acceptance.",
    primarySurface: "quote-approval",
  },
  schedule: {
    label: "Schedule",
    group: "core",
    eyebrow: "Dispatch",
    description: "Plan capacity, assign crews, and resolve scheduling conflicts.",
    primarySurface: "schedule",
  },
  jobs: {
    label: "Jobs",
    group: "core",
    eyebrow: "Field operations",
    description: "Track field work from assignment through completion and review.",
    primarySurface: "jobs",
  },
  invoices: {
    label: "Invoices",
    group: "core",
    eyebrow: "Finance",
    description: "Track customer balances, payments, and collection status.",
    primarySurface: "invoice-ledger",
  },
  quality: {
    label: "Quality",
    group: "operations",
    eyebrow: "Service quality",
    description: "Review service issues, ownership, deadlines, and resolution.",
    primarySurface: "quality-review",
  },
  automations: {
    label: "Automation Studio",
    group: "operations",
    eyebrow: "AI-assisted operations",
    description: "Generate staff-reviewed intake briefs, assess model readiness, and build controlled event-driven workflows.",
    primarySurface: "recovery-actions",
  },
  "ai-studio": {
    label: "AI Studio",
    group: "operations",
    eyebrow: "Staff copilot workspace",
    description: "Generate human-reviewed intelligence from saved requests and quotes; test model readiness and open governed AI workflows.",
    primarySurface: "ai-studio",
  },
  reports: {
    label: "Reports",
    group: "operations",
    eyebrow: "Insights",
    description: "Monitor conversion, collections, workload, and operational risk.",
    primarySurface: "reports",
  },
  settings: {
    label: "Settings",
    group: "settings",
    eyebrow: "Administration",
    description: "Manage services, team access, recurring work, and integrations.",
    primarySurface: "owner-settings",
  },
  billing: {
    label: "Billing",
    group: "settings",
    eyebrow: "Administration",
    description: "Manage the ServiceDesk subscription and workspace usage limits.",
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
    modules: ["quality", "ai-studio", "automations", "reports"],
  },
  {
    label: "Settings",
    modules: ["settings", "billing"],
  },
];

export function buildStaffModuleHref(workspaceSlug: string, module: StaffModule) {
  return `/app/${encodeURIComponent(workspaceSlug)}/${module}`;
}
