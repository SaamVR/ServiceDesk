import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("V2 multilane production integration", () => {
  it("uses one shared staff shell instead of nesting the legacy application chrome", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const layout = source("src/app/app/[workspace]/layout.tsx");

    expect(layout).toContain("StaffAppShell");
    expect(route).toContain("PageHeader");
    expect(route).not.toContain('className="site-shell"');
    expect(route).not.toContain('className="site-header"');
    expect(route).not.toContain("function StaffNavigation");
  });

  it("loads the staff overview from the authenticated operational runtime", () => {
    const page = source("src/app/app/[workspace]/overview/page.tsx");
    expect(page).toContain("loadOperationalStaffSnapshot");
    expect(page).toContain("snapshot={result.ok ? result.value : undefined}");
    expect(page).not.toContain("OperationalFixtureRoute");
  });

  it("keeps production crew routes off fixture surfaces", () => {
    for (const page of [
      "src/app/crew/today/page.tsx",
      "src/app/crew/jobs/[id]/page.tsx",
    ]) {
      const value = source(page);
      expect(value).not.toContain("OperationalFixtureRoute");
      expect(value).not.toContain("FIXTURE_UI_ONLY");
      expect(value).toContain("crew-product-runtime");
    }
  });

  it("scopes crew runtime to authenticated active crew membership", () => {
    const runtime = source("src/features/crew/crew-product-runtime.ts");
    expect(runtime).toContain("auth.auth.getUser()");
    expect(runtime).toContain('.from("crew_members")');
    expect(runtime).toContain('.eq("user_id", authData.user.id)');
    expect(runtime).toContain('.eq("active", true)');
    expect(runtime).toContain('.in("crew_id", crewIds)');
    expect(runtime).toContain("workspace.id");
  });

  it("presents field times with an explicit workspace timezone", () => {
    const models = source("src/features/crew/v2-field-models.ts");
    const today = source("src/app/crew/today/page.tsx");
    const detail = source("src/app/crew/jobs/[id]/page.tsx");

    expect(models).toContain('function formatWindow(visit: VisitDTO, timeZone = "UTC")');
    expect(models).toContain("timeZone });");
    expect(models).not.toContain('timeZone: "UTC"');
    expect(today).toContain("timeZone={result.value.workspace.timeZone}");
    expect(detail).toContain("timeZone={result.value.workspace.timeZone}");
  });

  it("integrates advisory dispatch into the live schedule and mutates only through the server action", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const component = source("src/features/dispatch/DispatcherIntelligence.tsx");
    const runtime = source("src/features/operations/operational-product-runtime.ts");

    expect(route).toContain("buildDispatchRecommendations");
    expect(route).toContain("buildCrewDayTimeline");
    expect(route).toContain("<DispatcherIntelligence");
    expect(route).toContain("assignOperationalCrew");
    expect(component).toContain('type="hidden" name="expectedVersion"');
    expect(component).toContain("approvalAction");
    expect(runtime).toContain("assignVisitCrewWithPostgres");
  });

  it("locks the authoritative assignment RPC to staff/version/active crew/no-overlap and service role", () => {
    const migration = source("supabase/migrations/0016_v2_dispatch_assignment.sql");

    expect(migration).toContain("security invoker");
    expect(migration).toContain("servicedesk_require_staff");
    expect(migration).toContain("v_visit.version <> v_expected");
    expect(migration).toContain("CREW_NOT_AVAILABLE");
    expect(migration).toContain("CREW_SCHEDULE_CONFLICT");
    expect(migration).toContain("other.starts_at < v_visit.ends_at");
    expect(migration).toContain("other.ends_at > v_visit.starts_at");
    expect(migration).toContain("revoke all on function public.servicedesk_assign_visit_crew(jsonb) from anon");
    expect(migration).toContain("revoke all on function public.servicedesk_assign_visit_crew(jsonb) from authenticated");
    expect(migration).toContain("grant execute on function public.servicedesk_assign_visit_crew(jsonb) to service_role");
  });

  it("keeps customer and public production routes out of the legacy demo shell", () => {
    const customer = source("src/features/operations/CustomerProductRoute.tsx");
    const business = source("src/features/operations/BusinessProductRoute.tsx");

    expect(customer).toContain("portalShell");
    expect(customer).not.toContain('className="site-shell"');
    expect(customer).not.toContain("Start sandbox checkout");
    expect(business).toContain("businessShell");
    expect(business).not.toContain('className="site-shell"');
    expect(business).not.toContain("sandbox-only");
  });

  it("keeps crew offline truth explicit rather than claiming durable offline support", () => {
    const sync = source("src/features/crew/sync-state.ts");
    expect(sync).toContain('persistence: "SESSION_MEMORY_ONLY"');
    expect(sync).toContain("Offline changes are not saved after you close or reload the page.");
  });
});
