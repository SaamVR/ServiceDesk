import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { StaffAppShell } from "../../src/components/product/StaffAppShell";
import { RegistrationSubmitButton } from "../../src/features/auth/RegistrationSubmitButton";

const route = vi.hoisted(() => ({ pathname: "/app/acme-west/overview" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("next/link", () => ({ default: "a" }));

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function renderShell(pathname: string, workspace = "acme-west") {
  route.pathname = pathname;
  return renderToStaticMarkup(createElement(StaffAppShell, {
    workspace,
    signedIn: true,
  }, createElement("p", null, "Authorized workspace")));
}

describe("V4 frontend guarded navigation and submissions", () => {
  it("retains parent module and rail selection in nested job routes", () => {
    const html = renderShell("/app/acme-west/jobs/visit-42");
    expect(html).toContain("<strong>Jobs</strong>");
    expect(html).toContain('aria-label="Jobs workspace"');
    expect(html.split('aria-current="page" href="/app/acme-west/jobs"').length - 1).toBe(2);
  });

  it("handles encoded tenant URL segments and avoids misleading prefix matches", () => {
    const html = renderShell("/app/east%2Fwest/automations/receipt-42", "east/west");
    expect(html).toContain("<strong>AI &amp; Automation</strong>");
    expect(html).toContain('aria-label="AI &amp; Automation workspace"');
    expect(html.split('aria-current="page" href="/app/east%2Fwest/automations"').length - 1).toBe(2);
    const unknown = renderShell("/app/acme-west/jobs-archive");
    expect(unknown).toContain('aria-label="Overview workspace"');
    expect(unknown).not.toContain('aria-label="Jobs workspace"');
  });

  it("disables the reusable auth submit only if registration is unavailable", () => {
    const ready = renderToStaticMarkup(createElement("form", null,
      createElement(RegistrationSubmitButton, {
        label: "Sign in", pendingLabel: "Signing in…",
      })));
    const gated = renderToStaticMarkup(createElement("form", null,
      createElement(RegistrationSubmitButton, {
        label: "Create account", pendingLabel: "Creating account…", disabled: true,
      })));
    expect(ready).toContain('type="submit"');
    expect(ready).toContain("Sign in");
    expect(ready).not.toContain('disabled=""');
    expect(ready).toContain('aria-live="polite"');
    expect(gated).toContain('disabled=""');
    expect(gated).toContain("Create account");
  });

  it("keeps authentication form actions and server-side enrollment gates", () => {
    const signup = source("src/app/auth/sign-up/page.tsx");
    const signin = source("src/app/auth/sign-in/page.tsx");
    const submit = source("src/features/auth/RegistrationSubmitButton.tsx");
    expect(signup).toContain("action={signUpWithPassword}");
    expect(signup).toContain("disabled={!registrationEnabled}");
    expect(signup).toContain('pendingLabel="Creating account…"');
    expect(signin).toContain("action={signInWithPassword}");
    expect(signin).toContain('pendingLabel="Signing in…"');
    expect(submit).toContain("useFormStatus()");
    expect(submit).toContain("disabled={disabled || pending}");
    expect(submit).toContain("aria-busy={busy || undefined}");
    expect(submit).not.toContain("onClick=");
  });

  it("guards priced catalog activation and branch switching without changing actions", () => {
    const pricing = source("src/features/operations/OwnerCleaningPricingSetupForm.tsx");
    const branch = source("src/features/operations/BranchScopeBar.tsx");
    const staffButton = source("src/components/product/StaffSubmitButton.tsx");
    expect(pricing).toContain("action={action}");
    expect(pricing).toContain('name="setupId"');
    expect(pricing).toContain('pendingLabel="Saving pricing…"');
    expect(pricing).toContain("Save verified first-run pricing");
    expect(pricing).not.toContain("<button type=\"submit\"");
    expect(branch).toContain("action={action}");
    expect(branch).toContain('name="branchScope"');
    expect(branch).toContain('pendingLabel="Applying scope…"');
    expect(staffButton).toContain("disabled={Boolean(disabled || pending)}");
    expect(staffButton).toContain("aria-busy={pending || undefined}");
  });
});
