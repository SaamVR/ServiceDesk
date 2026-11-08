import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trustedWorkspaceRegistrationError, workspaceRegistrationNeedsReadback } from "../../src/features/auth/workspace-registration-error";
import { validateWorkspaceFields } from "../../src/features/auth/registration";
import { GET as continueOwnerJourney } from "../../src/app/auth/continue/route";
import CreateWorkspacePage from "../../src/app/auth/create-workspace/page";
import SelectWorkspacePage from "../../src/app/auth/select-workspace/page";
import VerifiedOwnerWorkspacePage from "../../src/app/onboarding/verified/page";

const ownerNavigation = vi.hoisted(() => ({
  getUser: vi.fn(), membership: vi.fn(), workspace: vi.fn(), customers: vi.fn(),
}));
const ownerLandingReadback = vi.hoisted(() => ({
  verifiedOwner: vi.fn(), savedDefaultBranch: vi.fn(),
}));
vi.mock("../../src/features/auth/verified-owner-workspace", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/features/auth/verified-owner-workspace")>(),
  loadVerifiedOwnerWorkspace: ownerLandingReadback.verifiedOwner,
  verifySavedOwnerDefaultBranch: ownerLandingReadback.savedDefaultBranch,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], setAll: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string): never => { throw Error("MOCK_REDIRECT:" + path); },
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: ownerNavigation.getUser },
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        limit(count: number) {
          if (table === "memberships") {
            expect(count).toBe(101);
            return ownerNavigation.membership();
          }
          if (table === "workspaces") {
            expect(count).toBe(101);
            return ownerNavigation.workspace();
          }
          if (table === "customers") {
            expect(count).toBe(1);
            return ownerNavigation.customers();
          }
          throw Error("UNEXPECTED_TABLE");
        },
      };
    },
  }),
}));


describe("P02 bounded workspace setup error presentation", () => {
  it("preserves intended server-originated registration messages", () => {
    for (const message of [
      "Workspace creation is not approved for this account. Contact the administrator.",
      "Workspace registration may have committed, but saved owner access could not be verified. Use your authorized workspaces to check before trying again.",
      "This workspace address is taken. Try another.",
      "Verify your email before creating a workspace.",
      "Business name must be between 2 and 120 characters.",
      "Workspace address must be 3–40 lowercase letters, numbers or single hyphens.",
      "Select another business timezone.",
      "Choose a supported business currency.",
    ]) {
      expect(trustedWorkspaceRegistrationError(message)).toBe(message);
    }
  });
  it("keeps ambiguous RPC completion messages from the real action visible and advisory", () => {
    const server = readFileSync("src/app/auth/create-workspace/actions.ts", "utf8");
    for (const message of ["Workspace registration may have committed, but its result could not be confirmed. Check your authorized workspaces before trying again.", "Workspace registration may have committed, but saved owner access could not be verified. Use your authorized workspaces to check before trying again."]) {
      expect(server).toContain('fail("' + message + '")');
      expect(trustedWorkspaceRegistrationError(message)).toBe(message);
      expect(workspaceRegistrationNeedsReadback(message)).toBe(true);
    }
  });
  it("links only bounded uncertain registration feedback to saved-workspace verification", () => {
    const source = readFileSync("src/app/auth/create-workspace/page.tsx", "utf8");
    expect(source).toContain("workspaceRegistrationNeedsReadback(query.error)");
    expect(source).toContain('<Link href="/auth/continue">Check your authorized workspaces</Link>');
    expect(source).toContain("Do not submit another workspace registration");
    for (const raw of [null, {}, [], "Unknown", "<script>alert(1)</script>",
      "This workspace address is taken. Try another.", "Please send your password"]) {
      expect(workspaceRegistrationNeedsReadback(raw)).toBe(false);
    }
    expect(source).not.toContain("service_role");
  });
  it("does not render untrusted URL instructions as product errors", () => {
    for (const attackerText of [
      "Security alert: email your password to admin@attacker.example",
      "<img src=x onerror=alert(1)>",
      "Contact support at https://attacker.example",
      "Workspace creation is not approved for this account. Contact the administrator.\nPlease pay now.",
      "Registration succeeded, you may share your credentials.",
      "A".repeat(10000),
    ]) {
      const shown = trustedWorkspaceRegistrationError(attackerText);
      expect(shown).toBe("Workspace setup could not be completed. Please try again or contact the administrator.");
      expect(shown).not.toContain(attackerText);
    }
  });
  it("omits absent or invalid-shaped error values", () => {
    for (const value of [null, undefined, "", ["approved"], { message: "forged" }, 123]) {
      expect(trustedWorkspaceRegistrationError(value)).toBeNull();
    }
  });
  it("aligns browser slug validation with the authoritative server validator", () => {
    const page = readFileSync("src/app/auth/create-workspace/page.tsx", "utf8");
    const pattern = page.match(/name="slug" pattern="([^"]+)"/)?.[1];
    expect(pattern).toBeTruthy();
    expect(page).toContain('minLength={3} maxLength={40}');
    const browserPattern = new RegExp("^(?:" + pattern + ")$", "v");
    for (const slug of [
      "abc", "a-b", "a1-b2", "a".repeat(40),
      "ab", "a--b", "abc-", "-abc", "abc_", "a".repeat(41),
    ]) {
      const browserValid = slug.length >= 3 && slug.length <= 40 && browserPattern.test(slug);
      const serverValid = validateWorkspaceFields({
        name: "Example Cleaning", slug, timezone: "UTC", currency: "USD",
      }) === null;
      expect(browserValid, slug).toBe(serverValid);
    }
  });

  it("requires the actual workspace page to use the trusted presentation result", () => {
    const page = readFileSync("src/app/auth/create-workspace/page.tsx", "utf8");
    expect(page).toContain("trustedWorkspaceRegistrationError(query.error)");
    expect(page).not.toContain("new URLSearchParams");
    expect(page).toContain("{trustedError}");
    expect(page).not.toContain("{query.error}");
  });
  it("warns before non-USD workspace registration that first-run cleaning prices are USD-only", () => {
    const page = readFileSync("src/app/auth/create-workspace/page.tsx", "utf8");
    const backend = readFileSync("src/features/operations/owner-pricing-readiness.ts", "utf8");
    expect(page).toContain('aria-describedby="workspace-currency-hint"');
    expect(page).toContain('id="workspace-currency-hint"');
    expect(page).toContain("First-run cleaning pricing currently supports USD branches only.");
    expect(page).toContain("Do not choose USD unless your business actually bills in USD.");
    expect(backend).toContain('currency === "USD"');
    for (const currency of ["USD", "GBP", "EUR", "CAD", "AUD", "BDT"]) {
      expect(page).toContain('value="' + currency + '"');
      expect(validateWorkspaceFields({
        name: "Cleaning Company", slug: "cleaning-company", timezone: "UTC", currency,
      })).toBeNull();
    }
    expect(page).not.toContain('name="currency" type="hidden"');
  });

});

const syntheticOwner = "11111111-1111-4111-8111-111111111111";
const syntheticWorkspace = "33333333-3333-4333-8333-333333333333";
const expectedHost = "https://approved-preview.example.test";

function ownerTarget(response: Response) {
  expect(response.status).toBe(303);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const url = new URL(response.headers.get("location")!);
  expect(url.origin).toBe(expectedHost);
  return url;
}

describe("P02 post-confirmation owner navigation: real entrypoints fail closed", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_only");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", expectedHost);
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://legacy-preview.onrender.com");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED", "true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED", "true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_ENABLED", "false");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS", "approved@example.test");
    ownerNavigation.getUser.mockReset().mockResolvedValue({
      data: { user: { id: syntheticOwner, email: "approved@example.test",
        email_confirmed_at: "2026-11-07T00:00:00Z" } }, error: null,
    });
    ownerNavigation.membership.mockReset().mockResolvedValue({ data: [], error: null });
    ownerNavigation.workspace.mockReset().mockResolvedValue({ data: [], error: null });
    ownerNavigation.customers.mockReset().mockResolvedValue({ data: [], error: null });
    ownerLandingReadback.verifiedOwner.mockReset().mockResolvedValue({
      ok: true, workspace: { id: syntheticWorkspace, slug: "synthetic-cleaning",
        name: "Synthetic Cleaning", timezone: "UTC", currency: "USD" },
    });
    ownerLandingReadback.savedDefaultBranch.mockReset().mockResolvedValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  // Exact same signed-in QA setup as the actual owner-journey route cases.
  it("hides the real registration submit form while an uncertain RPC must be read back", async () => {
    const uncertain="Workspace registration may have committed, but its result could not be confirmed. Check your authorized workspaces before trying again.";
    const pending=await CreateWorkspacePage({ searchParams: Promise.resolve({ error: uncertain }) });
    // RegistrationShell receives a nested JSX tree, not necessarily a flat
    // child array; inspect recursively to cover actual conditional rendering.
    const hasForm = (node: unknown): boolean => {
      if (Array.isArray(node)) return node.some(hasForm);
      if (!node || typeof node !== "object") return false;
      const element=node as {type?: unknown;props?: {children?: unknown}};
      return element.type === "form" || hasForm(element.props?.children);
    };
    expect(hasForm(pending)).toBe(false);
    const normal=await CreateWorkspacePage({ searchParams: Promise.resolve({}) });
    expect(hasForm(normal)).toBe(true);
  });


  it("routes a thrown Auth identity response to a bounded login error, never a 500", async () => {
    ownerNavigation.getUser.mockRejectedValueOnce(Error("PRIVATE_AUTH_TRANSPORT_TOKEN"));
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("error")).toBe("Sign in is temporarily unavailable.");
    expect(target.href).not.toContain("PRIVATE_AUTH_TRANSPORT_TOKEN");
    expect(ownerNavigation.membership).not.toHaveBeenCalled();
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("refuses an error-free but userless session without navigating to registration", async () => {
    ownerNavigation.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(ownerTarget(await continueOwnerJourney()).pathname).toBe("/auth/sign-in");
    expect(ownerNavigation.membership).not.toHaveBeenCalled();
  });

  it("routes an unconfirmed identity back to verification rather than owner setup", async () => {
    ownerNavigation.getUser.mockResolvedValueOnce({
      data: { user: { id: syntheticOwner, email_confirmed_at: null } }, error: null,
    });
    expect(ownerTarget(await continueOwnerJourney()).pathname).toBe("/auth/sign-up/check-email");
    expect(ownerNavigation.membership).not.toHaveBeenCalled();
  });

  it("denies a thrown tenant membership RLS transport read without customer or workspace fallback", async () => {
    ownerNavigation.membership.mockRejectedValueOnce(Error("PRIVATE_MEMBERSHIP_TRANSPORT"));
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("error")).toBe("Workspace lookup unavailable");
    expect(target.href).not.toContain("PRIVATE");
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("denies a thrown workspace RLS query for an otherwise confirmed owner", async () => {
    ownerNavigation.membership.mockResolvedValueOnce({
      data: [{ workspace_id: syntheticWorkspace, user_id: syntheticOwner,
        role: "OWNER", status: "ACTIVE" }], error: null,
    });
    ownerNavigation.workspace.mockRejectedValueOnce(Error("PRIVATE_WORKSPACE_TRANSPORT"));
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("error")).toBe("Workspace lookup unavailable");
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("does not offer a new workspace when ACTIVE OWNER membership has no RLS-visible workspace", async () => {
    ownerNavigation.membership.mockResolvedValueOnce({
      data: [{ workspace_id: syntheticWorkspace, user_id: syntheticOwner,
        role: "OWNER", status: "ACTIVE" }], error: null,
    });
    ownerNavigation.workspace.mockResolvedValueOnce({ data: [], error: null });
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("error")).toBe("Workspace lookup unavailable");
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("refuses partial workspace RLS visibility across multiple ACTIVE staff memberships", async () => {
    ownerNavigation.membership.mockResolvedValueOnce({
      data: [
        { workspace_id: syntheticWorkspace, user_id: syntheticOwner, role: "OWNER", status: "ACTIVE" },
        { workspace_id: "55555555-5555-4555-8555-555555555555",
          user_id: syntheticOwner, role: "DISPATCHER", status: "ACTIVE" },
      ], error: null,
    });
    ownerNavigation.workspace.mockResolvedValueOnce({
      data: [{ id: syntheticWorkspace, slug: "synthetic-cleaning", name: "Synthetic Cleaning" }],
      error: null,
    });
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("error")).toBe("Workspace lookup unavailable");
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("refuses a malformed RLS-visible OWNER workspace slug rather than reopening registration", async () => {
    ownerNavigation.membership.mockResolvedValueOnce({
      data: [{ workspace_id: syntheticWorkspace, user_id: syntheticOwner,
        role: "OWNER", status: "ACTIVE" }], error: null,
    });
    ownerNavigation.workspace.mockResolvedValueOnce({
      data: [{ id: syntheticWorkspace, slug: "../foreign", name: "Invalid Scoped Workspace" }],
      error: null,
    });
    const target=ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("error")).toBe("Workspace lookup unavailable");
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("does not silently fall back to CREW when an OWNER workspace has invalid saved routing metadata", async () => {
    ownerNavigation.membership.mockResolvedValueOnce({
      data: [
        { workspace_id: syntheticWorkspace, user_id: syntheticOwner,
          role: "OWNER", status: "ACTIVE" },
        { workspace_id: "77777777-7777-4777-8777-777777777777", user_id: syntheticOwner,
          role: "CREW", status: "ACTIVE" },
      ], error: null,
    });
    ownerNavigation.workspace.mockResolvedValueOnce({
      data: [{ id: syntheticWorkspace, slug: "invalid--slug", name: "Invalid Owner Address" }],
      error: null,
    });
    const target=ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.pathname).not.toBe("/crew/today");
    expect(target.searchParams.get("error")).toBe("Workspace lookup unavailable");
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("refuses a thrown customer lookup, never inferring the owner needs a new workspace", async () => {
    ownerNavigation.customers.mockRejectedValueOnce(Error("PRIVATE_CUSTOMER_NETWORK"));
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("error")).toBe("Account lookup unavailable");
    expect(target.pathname).not.toBe("/auth/create-workspace");
  });

  it("refuses an error-free but unverified customer-row shape", async () => {
    ownerNavigation.customers.mockResolvedValueOnce({ data: null, error: null });
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/sign-in");
    expect(target.searchParams.get("error")).toBe("Account lookup unavailable");
  });

  it("preserves genuine first-time owner setup after verified absence of workspace and customer rows", async () => {
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/auth/create-workspace");
    expect(ownerNavigation.membership).toHaveBeenCalledTimes(1);
    expect(ownerNavigation.customers).toHaveBeenCalledTimes(1);
  });

  it("preserves the authenticated customer portal path without owner registration", async () => {
    ownerNavigation.customers.mockResolvedValueOnce({
      data: [{ id: "44444444-4444-4444-8444-444444444444" }], error: null,
    });
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).toBe("/portal");
  });

  it("preserves already-authorized owner navigation ahead of customer lookup", async () => {
    ownerNavigation.membership.mockResolvedValueOnce({
      data: [{ workspace_id: syntheticWorkspace, user_id: syntheticOwner,
        role: "OWNER", status: "ACTIVE" }], error: null,
    });
    ownerNavigation.workspace.mockResolvedValueOnce({
      data: [{ id: syntheticWorkspace, slug: "synthetic-cleaning", name: "Synthetic Cleaning" }],
      error: null,
    });
    const target = ownerTarget(await continueOwnerJourney());
    expect(target.pathname).not.toBe("/auth/create-workspace");
    expect(target.pathname).not.toBe("/auth/sign-in");
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("denies thrown identity transport in the workspace chooser without exposing provider details", async () => {
    ownerNavigation.getUser.mockRejectedValueOnce(Error("PRIVATE_CHOOSER_AUTH_PROVIDER_TOKEN"));
    await expect(SelectWorkspacePage()).rejects.toThrow(
      "MOCK_REDIRECT:/auth/sign-in?error=Sign-in%20is%20temporarily%20unavailable.");
    expect(ownerNavigation.membership).not.toHaveBeenCalled();
  });

  it("shows a bounded retry screen after a thrown chooser membership RLS read", async () => {
    ownerNavigation.membership.mockRejectedValueOnce(Error("PRIVATE_CHOOSER_RLS_PROVIDER_TOKEN"));
    const view=await SelectWorkspacePage();
    expect(view.props.title).toBe("Workspace lookup is unavailable");
    expect(ownerNavigation.customers).not.toHaveBeenCalled();
  });

  it("rejects an unverified chooser identity before reading workspace memberships", async () => {
    ownerNavigation.getUser.mockResolvedValueOnce({ data: null, error: null });
    await expect(SelectWorkspacePage()).rejects.toThrow("MOCK_REDIRECT:/auth/sign-in");
    expect(ownerNavigation.membership).not.toHaveBeenCalled();
  });

  it("denies a thrown verified-owner landing Auth response without an HTTP 500 or QA fixture write", async () => {
    ownerNavigation.getUser.mockRejectedValueOnce(Error("PRIVATE_VERIFIED_OWNER_AUTH_TOKEN"));
    await expect(VerifiedOwnerWorkspacePage({
      searchParams: Promise.resolve({ workspace: "synthetic-cleaning", qaSeed: "created" }),
    })).rejects.toThrow(
      "MOCK_REDIRECT:/auth/sign-in?error=Sign-in%20is%20temporarily%20unavailable.");
    expect(ownerNavigation.membership).not.toHaveBeenCalled();
  });

  it("rejects userless verified-owner landing identity without showing a saved workspace", async () => {
    ownerNavigation.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(VerifiedOwnerWorkspacePage({
      searchParams: Promise.resolve({ workspace: "synthetic-cleaning" }),
    })).rejects.toThrow("MOCK_REDIRECT:/auth/sign-in?next=%2Fauth%2Fcontinue");
    expect(ownerNavigation.membership).not.toHaveBeenCalled();
  });

  it("denies the actual verified-owner landing for an owner without independently saved branch proof", async () => {
    ownerLandingReadback.savedDefaultBranch.mockResolvedValueOnce(false);
    const page = await VerifiedOwnerWorkspacePage({
      searchParams: Promise.resolve({ workspace: "synthetic-cleaning", qaSeed: "created" }),
    });
    expect(page.props.title).toBe("We could not verify this workspace");
    expect(ownerLandingReadback.verifiedOwner).toHaveBeenCalledTimes(1);
    expect(ownerLandingReadback.savedDefaultBranch).toHaveBeenCalledTimes(1);
    expect(ownerLandingReadback.savedDefaultBranch).toHaveBeenCalledWith(
      expect.anything(), syntheticOwner,
      expect.objectContaining({ id: syntheticWorkspace, slug: "synthetic-cleaning" }),
    );
  });

  it("refuses a thrown saved-branch lookup on verified-owner landing without an HTTP 500", async () => {
    ownerLandingReadback.savedDefaultBranch.mockRejectedValueOnce(Error("PRIVATE_BRANCH_TRANSPORT"));
    const page = await VerifiedOwnerWorkspacePage({
      searchParams: Promise.resolve({ workspace: "synthetic-cleaning" }),
    });
    expect(page.props.title).toBe("We could not verify this workspace");
  });

  it("retains the genuine owner-ready landing only with both saved owner and branch proof", async () => {
    const page = await VerifiedOwnerWorkspacePage({
      searchParams: Promise.resolve({ workspace: "synthetic-cleaning" }),
    });
    expect(page.props.title).toBe("Your business workspace is ready.");
    expect(ownerLandingReadback.savedDefaultBranch).toHaveBeenCalledTimes(1);
  });

  it("never attempts default-branch verification when the saved OWNER workspace itself is denied", async () => {
    ownerLandingReadback.verifiedOwner.mockResolvedValueOnce({ ok: false, reason: "DENIED" });
    const page = await VerifiedOwnerWorkspacePage({
      searchParams: Promise.resolve({ workspace: "foreign-tenant" }),
    });
    expect(page.props.title).toBe("We could not verify this workspace");
    expect(ownerLandingReadback.savedDefaultBranch).not.toHaveBeenCalled();
  });

  it("denies workspace setup page when Auth identity lookup throws", async () => {
    ownerNavigation.getUser.mockRejectedValueOnce(Error("PRIVATE_PAGE_AUTH"));
    await expect(CreateWorkspacePage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow("MOCK_REDIRECT:/auth/sign-in?next=%2Fauth%2Fcreate-workspace");
    expect(ownerNavigation.membership).not.toHaveBeenCalled();
  });

  it("denies workspace setup page for a null/partial identity", async () => {
    ownerNavigation.getUser.mockResolvedValueOnce({ data: null, error: null });
    await expect(CreateWorkspacePage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow("MOCK_REDIRECT:/auth/sign-in?next=%2Fauth%2Fcreate-workspace");
  });

  it("preserves the approved, verified owner workspace form and currency warning", async () => {
    const form = await CreateWorkspacePage({ searchParams: Promise.resolve({}) });
    expect(form.props.title).toBe("Make it yours.");
    expect(form.props.children).toBeTruthy();
    expect(ownerNavigation.getUser).toHaveBeenCalledTimes(1);
  });
});
