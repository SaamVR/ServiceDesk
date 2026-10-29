import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOwnerWorkspace } from "../../src/app/auth/create-workspace/actions";

const calls = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: calls.getUser },
    rpc: calls.rpc,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (href: string): never => {
    throw new Error("MOCK_REDIRECT:" + href);
  },
}));

const form = () => {
  const data = new FormData();
  data.set("businessName", "Synthetic Example Cleaning");
  data.set("slug", "synthetic-team");
  data.set("timezone", "UTC");
  data.set("currency", "USD");
  return data;
};
const destination = async () => {
  try {
    await createOwnerWorkspace(form());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toMatch(/^MOCK_REDIRECT:/);
    return decodeURIComponent(message.slice("MOCK_REDIRECT:".length));
  }
  throw new Error("ACTION_RETURNED_WITHOUT_REDIRECT");
};

describe("P02 owner registration: DB authority and truthful operator guidance", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", "https://synthetic.example.test");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED", "true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_ENABLED", "false");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED", "true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS", "approved@example.test");
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    calls.getUser.mockReset().mockResolvedValue({
      data: { user: { id: "synthetic-owner", email: "approved@example.test",
        email_confirmed_at: "2026-10-26T00:00:00Z" } }, error: null,
    });
    calls.rpc.mockReset().mockResolvedValue({
      data: { ok: true, slug: "synthetic-team", existing: false }, error: null,
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("shows approved-account guidance on DB-side denial, not invalid-form blame or success", async () => {
    calls.rpc.mockResolvedValueOnce({
      data: { ok: false, code: "REGISTRATION_NOT_AUTHORIZED" }, error: null,
    });
    const location = await destination();
    expect(location).toContain("/auth/create-workspace?error=");
    expect(location).toContain("not approved for this account");
    expect(location).not.toContain("/onboarding/verified");
    expect(location).not.toContain("Check your details");
    expect(calls.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a missing RPC response, nonboolean success, or malformed slug", async () => {
    for (const data of [
      null,
      { ok: "true", slug: "synthetic-team" },
      { ok: 1, slug: "synthetic-team" },
      { ok: true, slug: "../other" },
      { ok: true, slug: "synthetic--team" },
      { ok: true, slug: "" },
      { ok: true, slug: {}, existing: false },
      { ok: true, slug: "synthetic-team" },
      { ok: true, slug: "synthetic-team", existing: "false" },
      { ok: true, slug: "synthetic-team", existing: 1 },
      { ok: true, slug: "synthetic-team", existing: null },
      { ok: true, slug: "synthetic-team", existing: false, code: "SLUG_UNAVAILABLE" },
      { ok: true, slug: "synthetic-team", existing: true, code: "UNEXPECTED_SUCCESS_CODE" },
    ]) {
      calls.rpc.mockResolvedValueOnce({ data, error: null });
      const location = await destination();
      expect(location).toContain("/auth/create-workspace?error=");
      expect(location).not.toContain("/onboarding/verified");
    }
  });

  it("does not disclose provider errors or claim onboarding success when RPC fails", async () => {
    calls.rpc.mockResolvedValueOnce({
      data: { ok: true, slug: "synthetic-team", existing: false },
      error: { message: "Synthetic provider token or policy details" },
    });
    const location = await destination();
    expect(location).toContain("Workspace setup is unavailable");
    expect(location).not.toContain("Synthetic provider token");
    expect(location).not.toContain("/onboarding/verified");
  });

  it("retains existing specific user-correctable RPC errors", async () => {
    for (const [code, expected] of [
      ["SLUG_UNAVAILABLE", "address is taken"],
      ["EMAIL_VERIFICATION_REQUIRED", "Verify your email"],
      ["TIMEZONE_INVALID", "business timezone"],
    ]) {
      calls.rpc.mockResolvedValueOnce({ data: { ok: false, code }, error: null });
      expect(await destination()).toContain(expected);
    }
  });

  it("keeps the app-only verified-email allowlist before database access", async () => {
    calls.getUser.mockResolvedValueOnce({
      data: { user: { email: "unapproved@example.test",
        email_confirmed_at: "2026-10-26T00:00:00Z" } }, error: null,
    });
    expect(await destination()).toContain("limited to approved test accounts");
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("denies unverified user before invoking registration RPC", async () => {
    calls.getUser.mockResolvedValueOnce({
      data: { user: { email: "approved@example.test", email_confirmed_at: null } },
      error: null,
    });
    expect(await destination()).toContain("/auth/sign-in?notice=");
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("does not call the provider if the server's tenant approval switch is absent", async () => {
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED", "false");
    expect(await destination()).toContain("not enabled on this environment");
    expect(calls.getUser).not.toHaveBeenCalled();
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("accepts a complete newly-created workspace success receipt", async () => {
    calls.rpc.mockResolvedValueOnce({
      data: { ok: true, slug: "synthetic-team", existing: false }, error: null,
    });
    expect(await destination()).toBe("/onboarding/verified?workspace=synthetic-team");
  });

  it("redirects only on explicit true success with a valid returned workspace slug", async () => {
    calls.rpc.mockResolvedValueOnce({
      data: { ok: true, slug: "my-existing-team", existing: true }, error: null,
    });
    expect(await destination()).toBe("/onboarding/verified?workspace=my-existing-team");
    expect(calls.rpc).toHaveBeenCalledWith(
      "servicedesk_register_owner_workspace",
      { p_name: "Synthetic Example Cleaning", p_slug: "synthetic-team",
        p_timezone: "UTC", p_currency: "USD" },
    );
  });
});
