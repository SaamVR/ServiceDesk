import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const convertedStaff = [
  "inbox",
  "customers",
  "requests",
  "quotes",
  "schedule",
  "jobs",
  "invoices",
  "quality",
  "automations",
  "reports",
  "billing",
  "settings",
];

describe("V2 operational product routing", () => {
  it("removes fixture-first routing from converted staff modules", () => {
    for (const routeModule of convertedStaff) {
      const file = source("src/app/app/[workspace]/" + routeModule + "/page.tsx");
      expect(file).toContain("OperationalProductRoute");
      expect(file).not.toContain("OperationalFixtureRoute");
      expect(file).not.toContain("FIXTURE_UI_ONLY");
    }
  });

  it("removes fixture-first routing from customer and public production routes", () => {
    const customerPages = [
      "src/app/portal/page.tsx",
      "src/app/portal/properties/page.tsx",
      "src/app/portal/preferences/page.tsx",
      "src/app/portal/quotes/[id]/page.tsx",
      "src/app/portal/bookings/[id]/page.tsx",
      "src/app/portal/invoices/[id]/page.tsx",
    ];
    const businessPages = [
      "src/app/b/[slug]/page.tsx",
      "src/app/b/[slug]/enquire/page.tsx",
      "src/app/b/[slug]/book/page.tsx",
    ];
    for (const page of customerPages) {
      const file = source(page);
      expect(file).toContain("CustomerProductRoute");
      expect(file).not.toContain("OperationalFixtureRoute");
    }
    for (const page of businessPages) {
      const file = source(page);
      expect(file).toContain("BusinessProductRoute");
      expect(file).not.toContain("OperationalFixtureRoute");
    }
  });

  it("keeps production data access authenticated and workspace scoped", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain("auth.auth.getUser()");
    expect(runtime).toContain('.from("memberships")');
    expect(runtime).toContain('.eq("workspace_id", workspace.id)');
    expect(runtime).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(runtime).not.toContain("PROVIDER_VERIFIED");
  });

  it("uses authoritative V1 command implementations for supported mutations", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain("createPostgresConversationFacadeMethods");
    expect(runtime).toContain("createPostgresRequestQuoteCapacityFacadeMethods");
    expect(runtime).toContain("createPostgresManualPaymentQualityFacadeMethods");
    expect(runtime).toContain("createPostgresVisitFieldRuntimeFacadeMethods");
    expect(runtime).toContain("calculateOperationalQuote");
    expect(runtime).toContain("holdOperationalSlot");
    expect(runtime).toContain("transitionOperationalVisit");
  });

  it("keeps genuinely unsupported operations disabled while wiring authoritative crew assignment", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(route).toContain("attentionResourceHref");
    expect(route).toContain("Open related record");
    expect(route).toContain("Reference only");
    expect(route).toContain("does not simulate online settlement");
    expect(route).toContain("assignOperationalCrew");
    expect(route).toContain('assignmentAvailability={{ enabled: true');
    expect(runtime).toContain("facade.assignCrew");
  });

  it("scopes portal reads to the authenticated customer and keeps unsupported booking honest", () => {
    const runtime = source("src/features/operations/customer-product-runtime.ts");
    const route = source("src/features/operations/CustomerProductRoute.tsx");
    expect(runtime).toContain("auth.auth.getUser()");
    expect(runtime).toContain('.eq("auth_user_id", authData.user.id)');
    expect(runtime).toContain('.eq("customer_id", customer.id)');
    expect(runtime).toContain("acceptCustomerPortalQuote");
    expect(route).toContain("CustomerPortalShell");
    expect(route).toContain("Open sandbox payment");
    expect(route).toContain("No real money is charged");
    expect(route).not.toContain("FIXTURE_UI_ONLY");
  });

  it("uses one shared staff shell and loads Overview from live operational data", () => {
    const layout = source("src/app/app/[workspace]/layout.tsx");
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const overview = source("src/app/app/[workspace]/overview/page.tsx");
    expect(layout).toContain("StaffAppShell");
    expect(route).not.toContain('className="site-shell"');
    expect(route).not.toContain('className="site-header"');
    expect(route).not.toContain("function StaffNavigation");
    expect(overview).toContain("loadOperationalStaffSnapshot");
    expect(overview).toContain("snapshot={result.ok ? result.value : undefined}");
    expect(overview).not.toContain("OperationalFixtureRoute");
    expect(route).not.toContain("plain-card");
  });

  it("adopts W1 primitives and W3 dispatch components without duplicating their logic", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const adapter = source("src/features/operations/dispatch-product-adapter.ts");
    expect(route).toContain("DataTable");
    expect(route).toContain("SplitWorkspace");
    expect(route).toContain("FeedbackBanner");
    expect(route).toContain("FormSection");
    expect(route).toContain("DispatcherIntelligence");
    expect(adapter).toContain("buildDispatchRecommendations");
    expect(adapter).toContain("buildCrewDayTimeline");
  });

  it("surfaces accepted field commands and sanitizes backend failures", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    const qualityPage = source("src/app/app/[workspace]/quality/page.tsx");
    expect(runtime).toContain("addOperationalVisitNote");
    expect(runtime).toContain("setOperationalChecklistItem");
    expect(runtime).toContain("applyOperationalRecurrenceAction");
    expect(runtime).toContain("safeCoreFailure");
    expect(runtime).not.toContain("message: result.message");
    expect(qualityPage).toContain("selectedQualityCaseId={query.case}");
  });

  it("renders reports, billing and settings as business admin views rather than preview components", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).not.toContain("ReportsPreview");
    expect(route).not.toContain("PlatformBillingPreview");
    expect(route).not.toContain("OwnerSettingsPreview");
    expect(route).toContain("Scheduled service");
    expect(route).toContain("ServiceDesk subscription");
    expect(route).toContain("Service catalog");
  });
});
