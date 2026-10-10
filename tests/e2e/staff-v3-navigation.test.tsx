import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
    children: createElement("p", null, "Operational workspace"),
  }));
}

describe("V3 staff workday shell", () => {
  it("retains access to all thirteen existing operational destinations in desktop and mobile navigation", () => {
    const html = renderStaffShell("/app/acme-west/overview");
    for (const module of Object.keys(staffModuleConfig) as Array<keyof typeof staffModuleConfig>) {
      const href = buildStaffModuleHref("acme-west", module);
      const occurrences = html.split(`href="${href}"`).length - 1;
      expect(occurrences, `Expected reachable destination: ${module}`).toBeGreaterThanOrEqual(2);
    }
    expect(html).toContain('aria-label="Workspace"');
    expect(html).toContain('aria-label="Mobile workspace"');
    expect(html).toContain('aria-label="Open workspace navigation"');
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

  it("retains encoded workspace routing and safe account sign-out semantics", () => {
    const html = renderStaffShell("/app/east%2Fwest/quality", "east/west");
    expect(html).toContain('href="/app/east%2Fwest/quality"');
    expect(html).toContain('action="/auth/sign-out"');
    expect(html).toContain('method="post"');
  });
});
