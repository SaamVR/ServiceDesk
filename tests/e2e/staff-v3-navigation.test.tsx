import "./v3-hosting-commit-identity.test";
import "./v3-public-story-hero.test";
import "./v4-clean-air-home.test";
import "./v4-clean-public-pages.test";
import "./v4-tour-sandbox-design.test";
import "./v3-public-route-metadata.test";
import "./v3-private-qa-paths.test";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import "./v3-studio-readable-density.test";
import "./v3-studio-finance-readability.test";
import "./v3-studio-finance-team.test";
import "./v3-studio-workflow-counts.test";
import "./v3-studio-visual-standard.test";
import "./v3-studio-dashboard.test";
import "./v3-studio-workspaces.test";
import "./v3-studio-brand-continuity.test";
import "./v3-studio-contrast.test";
import "./v3-studio-coverage.test";
import "./v3-studio-command-record-search.test";
import "./v3-record-directory.test";
import "./v3-studio-reply-brief.test";
import "./v3-studio-finance-workspaces.test";
import "./v3-studio-quote-version-safety.test";
import "./v3-inbox-delivery-presentation.test";
import "./v3-inbox-delivery-diagnostics.test";
import "./v3-staff-ai-review-composer.test";
import "./v3-operational-empty-actions.test";
import "./v3-studio-invoice-queue.test";
import "./v3-quality-triage.test";
import "./v3-studio-browser-matrix.test";
import "./v3-staff-boundary-theme.test";

import "./v2-product-truth.test";
import "./v3-studio-schedule-window.test";
import "./v3-studio-operational-continuity.test";
import "./v3-dispatch-coverage-week.test";
import { staffModuleConfig, buildStaffModuleHref } from "../../src/features/operations/staff-modules";
import { StaffAppShell } from "../../src/components/product/StaffAppShell";

const route = vi.hoisted(() => ({ pathname: "/app/acme-west/overview" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
// Exercise server-rendered navigation semantics without relying on a browser router.
vi.mock("next/link", () => ({ default: "a" }));

function renderStaffShell(pathname: string, workspace = "acme-west") {
  route.pathname = pathname;
  return renderToStaticMarkup(createElement(StaffAppShell, {
    workspace,
    signedIn: true,
  }, createElement("p", null, "Operational workspace")));
}

describe("V3 safe snapshot recovery contracts", () => {
  it("exposes GET-only retry destinations without raw provider errors", () => {
    const today = readFileSync(join(process.cwd(), "src/features/operations/StaffOverviewDashboard.tsx"), "utf8");
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const unavailable = route.slice(route.lastIndexOf('title={result.kind === "authentication"'));
    expect(today).toContain('href={buildStaffModuleHref(workspace, "overview")}');
    expect(today).toContain("Retry loading Today");
    expect(today).not.toContain("description={errorMessage ??");
    expect(unavailable).toContain("Retry view");
    expect(unavailable).toContain("href={buildStaffModuleHref(workspaceSlug, module)}");
    expect(unavailable).not.toContain("description={result.message}");
  });
});

describe("V3 staff workday shell", () => {
  it("provides Escape and link-click close paths for mobile workspace navigation", () => {
    const source = readFileSync(join(process.cwd(), "src/components/product/StaffAppShell.tsx"), "utf8");
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain('mobileMenu.current?.querySelector("summary")?.focus()');
    expect(source).toContain('onKeyDown={handleMobileNavigationKeyDown}');
    expect(source).toContain('onClick={handleMobileNavigationClick}');
  });

  it("retains access to all thirteen existing operational destinations in desktop and mobile navigation", () => {
    const html = renderStaffShell("/app/acme-west/overview");
    for (const staffModule of Object.keys(staffModuleConfig) as Array<keyof typeof staffModuleConfig>) {
      const href = buildStaffModuleHref("acme-west", staffModule);
      const occurrences = html.split(`href="${href}"`).length - 1;
      expect(occurrences, `Expected reachable destination: ${staffModule}`).toBeGreaterThanOrEqual(2);
    }
    expect(html).toContain('aria-label="Workspace"');
    expect(html).toContain('aria-label="Mobile workspace"');
    expect(html).toContain('aria-label="Open workspace navigation"');
    expect(html).toContain('class="app-mobile-nav-panel"');

    expect(html).toContain('href="#app-main-content"');
  });

  it("makes workday and customer flows direct, with secondary tools behind keyboard-accessible disclosure", () => {
    const html = renderStaffShell("/app/acme-west/inbox");
    expect(html).toContain("Workday");
    expect(html).toContain("Customer work");
    expect(html).toContain("<summary");
    expect(html).toContain("More tools");
    expect(html).toContain('href="/app/acme-west/inbox"');
    expect(html).toMatch(/aria-current="page"[^>]*href="\/app\/acme-west\/inbox"/);
    // A normal workday view must not expand the optional secondary drawer.
    expect(html.match(/<details[^>]*open=""/g)).toBeNull();
  });

  it("opens secondary navigation when a deep linked route needs an active item", () => {
    const html = renderStaffShell("/app/acme-west/settings");
    expect(html.match(/<details[^>]*open=""/g)).toHaveLength(2);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/app\/acme-west\/settings"/);
  });

  it("includes an accessible keyboard command palette without changing authorization or routes", () => {
    const html = renderStaffShell("/app/acme-west/inbox");
    expect(html).toContain("Find pages or records");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('type="search"');
    expect(html).toContain("Find your next action");
    expect(html).toContain('aria-label="Close workspace navigation"');
    expect(html).toContain('href="/app/acme-west/jobs"');
    expect(html).toContain('href="/app/acme-west/inbox"');
  });

  it("keeps workspace switching reachable when compact topbars hide desktop actions", () => {
    const html = renderStaffShell("/app/acme-west/inbox");
    const css = readFileSync(join(process.cwd(), "src/components/product/StaffWorkspaceV3.module.css"), "utf8");
    const source = readFileSync(join(process.cwd(), "src/components/product/StaffAppShell.tsx"), "utf8");
    expect(html.split('href="/auth/select-workspace"')).toHaveLength(3);
    expect(html).toContain("Account settings");
    expect(source).toContain('onToggle={handleMobileNavigationToggle}');
    expect(source).toContain('mobileNavOpen ? "Close workspace navigation" : "Open workspace navigation"');
    expect(css).toContain(".v3Shell .desktopWorkspaceSwitch { display: none; }");
    expect(css).toContain(".mobileAccountActions a");
    expect(css).toContain("min-height: 44px");
  });

  it("does not crash on literal percent signs in an authorized workspace name", () => {
    const html = renderStaffShell("/app/crew%25work/overview", "crew%work");
    expect(html).toContain("Crew%Work");
    expect(html).toContain('href="/app/crew%25work/overview"');
  });

  it("keeps Today and workflow counts scoped to the customer collections destination", () => {
    const dashboard = readFileSync(join(process.cwd(), "src/features/operations/StaffOverviewDashboard.tsx"), "utf8");
    const counts = readFileSync(join(process.cwd(), "src/features/operations/operational-journey-counts.ts"), "utf8");
    expect(dashboard).toContain("summarizeOutstandingInvoices(snapshot.invoices.filter((invoice) => Boolean(invoice.quoteId)))");
    expect(counts).toContain("summarizeOutstandingInvoices(snapshot.invoices.filter((invoice) => Boolean(invoice.quoteId))).count");
  });

  it("keeps request workday quote context bound to the latest valid version", () => {
    const routeSource = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const requests = routeSource.slice(routeSource.indexOf("function RequestsView("), routeSource.indexOf("function QuotesView("));
    expect(requests).toContain("indexCurrentQuoteByRequest(data.quotes)");
    expect(requests).toContain("!quoteByRequestId.has(request.id)");
    expect(requests).not.toContain("!data.quotes.some(");
  });

  it("retains encoded workspace routing and safe account sign-out semantics", () => {
    const html = renderStaffShell("/app/east%2Fwest/quality", "east/west");
    expect(html).toContain('href="/app/east%2Fwest/quality"');
    expect(html).toContain('action="/auth/sign-out"');
    expect(html).toContain('method="post"');
    expect(html).toContain('href="/auth/select-workspace"');
    expect(html).toContain("Switch workspace");
  });
});
