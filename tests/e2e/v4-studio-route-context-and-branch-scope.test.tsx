import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { StaffAppShell } from "../../src/components/product/StaffAppShell";

const route = vi.hoisted(() => ({ pathname: "/app/acme-west/overview" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("next/link", () => ({ default: "a" }));

function render(pathname: string, workspace = "acme-west") {
  route.pathname = pathname;
  return renderToStaticMarkup(createElement(
    StaffAppShell,
    { workspace, signedIn: true },
    createElement("p", null, "Authorized operational content"),
  ));
}

describe("V4 Studio route and branch-scope reliability", () => {
  it("keeps the actual parent module and selected rail item on nested record paths", () => {
    const html = render("/app/acme-west/jobs/visit-42");
    expect(html).toMatch(/class="app-topbar-context"[^>]*>.*?<strong>Jobs<\/strong>/);
    expect(html.split('aria-current="page" href="/app/acme-west/jobs"').length - 1).toBe(2);
    expect(html).toContain('aria-label="Jobs workspace"');
    expect(html).not.toContain('aria-label="Overview workspace"');
  });

  it("resolves encoded workspace paths without confusing similar module prefixes", () => {
    const html = render("/app/east%2Fwest/automations/run-42", "east/west");
    expect(html).toMatch(/class="app-topbar-context"[^>]*>.*?<strong>AI &amp; Automation<\/strong>/);
    expect(html.split('aria-current="page" href="/app/east%2Fwest/automations"').length - 1).toBe(2);
    const unknown = render("/app/acme-west/jobs-archive");
    expect(unknown).toContain('aria-label="Overview workspace"');
    expect(unknown).not.toContain('aria-label="Jobs workspace"');
  });

  it("uses the existing React 19 pending-aware submit guard for branch changes", () => {
    const branchScope = readFileSync(join(process.cwd(), "src/features/operations/BranchScopeBar.tsx"), "utf8");
    const button = readFileSync(join(process.cwd(), "src/components/product/StaffSubmitButton.tsx"), "utf8");
    expect(branchScope).toContain('import { StaffSubmitButton } from "@/components/product/StaffSubmitButton"');
    expect(branchScope).toContain('pendingLabel="Applying scope…"');
    expect(branchScope).toContain('>Apply scope</StaffSubmitButton>');
    expect(branchScope).toContain('name="branchScope"');
    expect(branchScope).toContain('action={action}');
    expect(button).toContain('disabled={Boolean(disabled || pending)}');
    expect(button).toContain('aria-busy={pending || undefined}');
    expect(button).toContain('useFormStatus()');
  });
});
