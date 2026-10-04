export type ClaimLevel = "IMPLEMENTED_UI" | "CONFIGURATION_BLOCKED";
export type UiStateScenario = {
  state: "loading" | "empty" | "error";
  tone: "pending" | "neutral" | "failure";
  title: string;
  detail: string;
  actionLabel?: string;
  ariaLive: "polite" | "assertive";
};

export const uiDesignTokens = {
  page: "#F6F7F7",
  section: "#EEF0F0",
  surface: "#FFFFFF",
  text: "#17211D",
  action: "#14634A",
  attention: "#9A6500",
  failure: "#A63A3A",
  pending: "#66736D",
} as const;

export const uiStateScenarios: UiStateScenario[] = [
  {
    state: "loading",
    tone: "pending",
    title: "Loading workspace records",
    detail: "The route shell is waiting for facade/API data before showing operational records.",
    ariaLive: "polite",
  },
  {
    state: "empty",
    tone: "neutral",
    title: "No records yet",
    detail: "Show a clear next action instead of filling the screen with fake business data.",
    actionLabel: "Start first request",
    ariaLive: "polite",
  },
  {
    state: "error",
    tone: "failure",
    title: "Could not load this workspace",
    detail: "Preserve the current route and let staff retry or contact support without losing context.",
    actionLabel: "Retry loading",
    ariaLive: "assertive",
  },
];

export const productRoutes = [
  { href: "/", label: "Home", claimLevel: "IMPLEMENTED_UI" },
  { href: "/features", label: "Features", claimLevel: "IMPLEMENTED_UI" },
  { href: "/integrations", label: "Integrations", claimLevel: "CONFIGURATION_BLOCKED" },
  { href: "/use-cases/cleaning", label: "Cleaning use case", claimLevel: "IMPLEMENTED_UI" },
  { href: "/pricing", label: "Pricing", claimLevel: "CONFIGURATION_BLOCKED" },
  { href: "/help", label: "Help", claimLevel: "IMPLEMENTED_UI" },
  { href: "/contact", label: "Contact", claimLevel: "IMPLEMENTED_UI" },
  { href: "/privacy", label: "Privacy", claimLevel: "IMPLEMENTED_UI" },
  { href: "/terms", label: "Terms", claimLevel: "IMPLEMENTED_UI" },
] as const;

export const moveOutFixture = {
  currency: "USD",
  service: "Move-out clean",
  bedrooms: 3,
  bathrooms: 2,
  addOns: ["Oven clean"],
  totalMinor: 34_000,
  depositMinor: 8_500,
  balanceMinor: 25_500,
  serviceMinutes: 240,
  bufferMinutes: 30,
  validHours: 48,
  holdMinutes: 15,
} as const;

export const operationalBenefits = [
  "Turn every enquiry into a structured request with a visible next action.",
  "Quote, hold capacity, collect deposit and schedule without duplicate work.",
  "Give dispatchers, crews and customers one shared record from first message to paid invoice.",
] as const;

export const lifecycleSteps = [
  "Enquiry captured from website or WhatsApp",
  "AI-assisted intake asks only missing questions",
  "Dispatcher reviews editable request summary",
  "Versioned quote is sent and accepted",
  "Customer selects a fresh available slot",
  "Deposit confirms the visit and Calendar job",
  "Crew completes checklist, photos and time notes",
  "Balance invoice, receipt, feedback and recurrence follow",
] as const;

export const integrationCards = [
  {
    title: "WhatsApp Cloud API",
    state: "Awaiting Chat 2 controlled provider receipt",
    detail: "Inbox UI separates provider accepted, delivered and read states. No accepted-as-delivered shortcut.",
  },
  {
    title: "Google Calendar",
    state: "Awaiting Chat 2 OAuth and event lifecycle proof",
    detail: "Schedule UI shows availability freshness, stale-calendar blocking and external-busy conflicts.",
  },
  {
    title: "Payments",
    state: "Sandbox only until verified payment receipt exists",
    detail: "Checkout panels label test mode and never display paid receipts until callback evidence is verified.",
  },
  {
    title: "AI assistant",
    state: "Bounded to approved tools and handover state",
    detail: "AI can draft, summarize and explain; it cannot set price, paid state, role or slot authority.",
  },
] as const;

export const customerJourneyCards = [
  {
    title: "Conversation + summary",
    detail: "Desktop uses a 60/40 enquiry split; mobile uses Conversation and Your request tabs.",
    state: "Collecting missing area, service and date fields",
  },
  {
    title: "Versioned quote",
    detail: "The current quote version stores price, duration, deposit, validity and rate version.",
    state: "$340 total · $85 deposit · $255 balance",
  },
  {
    title: "Appointment hold",
    detail: "A 15-minute hold is shown separately from confirmed visit state and payment status.",
    state: "Fresh slot · 240m service + 30m buffer",
  },
] as const;

export const staffModules = [
  "Overview attention queue",
  "Shared inbox and handover",
  "Customers and properties",
  "Requests and quote approvals",
  "Crew schedule and conflicts",
  "Jobs, invoices and quality cases",
  "Reports from stored records",
  "Automation and integration health",
] as const;

export const crewActions = [
  "Start travel",
  "Start job",
  "Complete checklist",
  "Add photo evidence",
  "Record time/material note",
  "Report incident",
  "Submit completion review",
] as const;

export const tourScenarios = [
  {
    id: "enquiry-to-paid-job",
    title: "WhatsApp enquiry to paid job",
    summary: "A synthetic WhatsApp-style enquiry becomes a structured request, deterministic quote, sandbox deposit, crew visit and invoice balance.",
    providerEvidence: "SYNTHETIC_UNTIL_CHAT_2_VERIFIED",
    routeLinks: [
      { href: "/b/brightroom/enquire", label: "Business enquiry" },
      { href: "/portal/quotes/quote_moveout_001", label: "Customer quote" },
      { href: "/portal/bookings/visit_showcase_001", label: "Booking state" },
      { href: "/crew/jobs/visit_showcase_001", label: "Crew job" },
      { href: "/portal/invoices/invoice_showcase_001", label: "Invoice" },
    ],
    steps: [
      {
        label: "Enquiry capture",
        detail: "The public enquiry route shows request fields beside an editable structured summary.",
        routeHref: "/b/brightroom/enquire",
        proofBoundary: "FIXTURE_UI_ONLY",
      },
      {
        label: "Deterministic quote",
        detail: "The customer quote route uses the frozen $340/$85/$255 move-out fixture and version label.",
        routeHref: "/portal/quotes/quote_moveout_001",
        proofBoundary: "FIXTURE_UI_ONLY",
      },
      {
        label: "Sandbox deposit",
        detail: "Checkout displays hold, sandbox payment state and hidden receipt until callback evidence exists.",
        routeHref: "/portal/bookings/visit_showcase_001",
        proofBoundary: "SANDBOX",
      },
      {
        label: "Crew execution",
        detail: "The crew route shows status, checklist, field proof placeholders, notes and completion boundary.",
        routeHref: "/crew/jobs/visit_showcase_001",
        proofBoundary: "FIXTURE_UI_ONLY",
      },
    ],
  },
  {
    id: "unusual-work-approval",
    title: "Unusual work needs staff approval",
    summary: "An exception path moves from attention ownership to request review, quote comparison and customer conversation handover.",
    providerEvidence: "SYNTHETIC_UNTIL_CHAT_2_VERIFIED",
    routeLinks: [
      { href: "/app/brightroom/overview", label: "Attention queue" },
      { href: "/app/brightroom/requests", label: "Request review" },
      { href: "/app/brightroom/quotes", label: "Quote approval" },
      { href: "/app/brightroom/inbox", label: "Customer conversation" },
    ],
    steps: [
      {
        label: "Needs review",
        detail: "The attention-first staff overview exposes owner, severity and next action.",
        routeHref: "/app/brightroom/overview",
        proofBoundary: "FIXTURE_UI_ONLY",
      },
      {
        label: "Structured request",
        detail: "The request summary keeps editable fields and quote readiness visible without mutating core state.",
        routeHref: "/app/brightroom/requests",
        proofBoundary: "FIXTURE_UI_ONLY",
      },
      {
        label: "Quote comparison",
        detail: "The quote route shows current version and approval boundary instead of silently accepting stale versions.",
        routeHref: "/app/brightroom/quotes",
        proofBoundary: "FIXTURE_UI_ONLY",
      },
      {
        label: "Customer reply",
        detail: "Inbox context stays separate from provider delivery proof and handover authority.",
        routeHref: "/app/brightroom/inbox",
        proofBoundary: "CONFIGURATION_BLOCKED",
      },
    ],
  },
  {
    id: "failed-send-recovery",
    title: "Failed send and stale Calendar recovery",
    summary: "Provider uncertainty, stale Calendar state and late payment become owned recovery actions instead of automatic retries.",
    providerEvidence: "SYNTHETIC_UNTIL_CHAT_2_VERIFIED",
    routeLinks: [
      { href: "/onboarding", label: "Provider readiness" },
      { href: "/app/brightroom/automations", label: "Recovery queue" },
      { href: "/app/brightroom/schedule", label: "Schedule freshness" },
      { href: "/app/brightroom/reports", label: "Reporting boundary" },
    ],
    steps: [
      {
        label: "Readiness blocked",
        detail: "Onboarding keeps setup status separate from provider proof and launch readiness.",
        routeHref: "/onboarding",
        proofBoundary: "CONFIGURATION_BLOCKED",
      },
      {
        label: "Owned recovery",
        detail: "Recovery actions require reconciliation before retries, reconnects or payment/capacity decisions.",
        routeHref: "/app/brightroom/automations",
        proofBoundary: "CONFIGURATION_BLOCKED",
      },
      {
        label: "Calendar freshness",
        detail: "Schedule view blocks instant confirmation when freshness or external-busy state is uncertain.",
        routeHref: "/app/brightroom/schedule",
        proofBoundary: "CONFIGURATION_BLOCKED",
      },
      {
        label: "Scoped reporting",
        detail: "Reports stay derived from stored sample records and avoid invented performance metrics.",
        routeHref: "/app/brightroom/reports",
        proofBoundary: "FIXTURE_UI_ONLY",
      },
    ],
  },
] as const;

export const presentationSlides = [
  { order: 1, title: "Cleaning businesses lose work in handoffs", body: "Messages, quote math, calendars, crews and invoices live in separate tools.", tourHref: "/tour#pain" },
  { order: 2, title: "ServiceDesk AI creates one operational record", body: "Every request has a status, owner, quote, slot, payment state and communication history.", tourHref: "/tour#promise" },
  { order: 3, title: "Customer journey", body: "The customer sees a clear enquiry, editable summary, quote, slot, invoices and preferences.", tourHref: "/tour#enquiry-to-paid-job" },
  { order: 4, title: "Staff inbox", body: "Dispatchers work from attention first, then inbox, customer context and approvals.", tourHref: "/tour#unusual-work-approval" },
  { order: 5, title: "Pricing fixture", body: "The move-out fixture is deterministic: $340 total, $85 deposit, $255 balance.", tourHref: "/tour#pricing" },
  { order: 6, title: "Scheduling and Calendar", body: "Availability freshness, holds, conflicts and provider sync states are visible.", tourHref: "/tour#failed-send-recovery" },
  { order: 7, title: "Crew execution", body: "Crew members get a mobile workspace for status, checklist, proof, time and incidents.", tourHref: "/tour#enquiry-to-paid-job" },
  { order: 8, title: "Collections and recurrence", body: "Deposit, balance, invoice allocation and repeat visits remain tied to stored records.", tourHref: "/tour#enquiry-to-paid-job" },
  { order: 9, title: "Recovery and AI boundaries", body: "The system shows failed delivery, handover and recovery without letting AI invent authority.", tourHref: "/tour#failed-send-recovery" },
  { order: 10, title: "Actual capabilities and walkthrough", body: "The presentation links to app routes and marks test history until provider receipts exist.", tourHref: "/tour#contact" },
] as const;

export const routeFamilies = {
  business: ["/b/[slug]", "/b/[slug]/enquire", "/b/[slug]/book"],
  customer: ["/portal", "/portal/properties", "/portal/quotes/[id]", "/portal/bookings/[id]", "/portal/invoices/[id]", "/portal/preferences"],
  staff: ["/app/[workspace]/overview", "/app/[workspace]/inbox", "/app/[workspace]/customers", "/app/[workspace]/requests", "/app/[workspace]/quotes", "/app/[workspace]/schedule", "/app/[workspace]/jobs", "/app/[workspace]/invoices", "/app/[workspace]/quality", "/app/[workspace]/automations", "/app/[workspace]/reports", "/app/[workspace]/settings", "/app/[workspace]/billing"],
  crew: ["/crew/today", "/crew/jobs/[id]"],
} as const;
