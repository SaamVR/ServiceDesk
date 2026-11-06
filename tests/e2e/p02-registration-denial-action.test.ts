import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOwnerWorkspace } from "../../src/app/auth/create-workspace/actions";

const calls = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: calls.getUser },
    rpc: calls.rpc,
    from: calls.from,
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string): never => {
    throw new Error("MOCK_REDIRECT:" + href);
  },
}));

const ownerId = "11111111-1111-4111-8111-111111111111";
const attackerId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const saved = {
  id: workspaceId, slug: "synthetic-team", name: "Synthetic Example Cleaning",
  timezone: "UTC", currency: "USD",
};
const membership = {
  workspace_id: workspaceId, user_id: ownerId, role: "OWNER", status: "ACTIVE",
};

function form() {
  const data = new FormData();
  data.set("businessName", "Synthetic Example Cleaning");
  data.set("slug", "synthetic-team");
  data.set("timezone", "UTC");
  data.set("currency", "USD");
  return data;
}
async function destination(): Promise<string> {
  try {
    await createOwnerWorkspace(form());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toMatch(/^MOCK_REDIRECT:/);
    return decodeURIComponent(message.slice("MOCK_REDIRECT:".length));
  }
  throw new Error("ACTION_RETURNED_WITHOUT_REDIRECT");
}

describe("P02 owner registration action: DB authority + saved readback", () => {
  let memberRows: unknown;
  let workspaceRow: unknown;
  let memberError: boolean;
  let workspaceError: boolean;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", "https://synthetic.example.test");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED", "true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_ENABLED", "false");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED", "true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS", "approved@example.test");
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    memberRows = [membership];
    workspaceRow = saved;
    memberError = false;
    workspaceError = false;
    calls.getUser.mockReset().mockResolvedValue({
      data: { user: {
        id: ownerId, email: "approved@example.test",
        email_confirmed_at: "2026-10-26T00:00:00Z",
      } }, error: null,
    });
    calls.rpc.mockReset().mockResolvedValue({
      data: { ok: true, slug: "synthetic-team", existing: false }, error: null,
    });
    calls.from.mockReset().mockImplementation((table: string) => {
      if (table === "memberships") return {
        select() { return this; },
        eq() { return this; },
        async limit(value: number) {
          expect(value).toBe(21);
          return { data: memberRows, error: memberError ? { code: "42501" } : null };
        },
      };
      if (table === "workspaces") return {
        select() { return this; },
        in() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: workspaceRow, error: workspaceError ? { code: "42501" } : null };
        },
      };
      throw new Error("UNEXPECTED_TABLE");
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("redirects only after independent session and saved owner/tenant readback", async () => {
    expect(await destination()).toBe("/onboarding/verified?workspace=synthetic-team");
    expect(calls.getUser).toHaveBeenCalledTimes(2);
    expect(calls.from.mock.calls.map(([table]) => table)).toEqual([
      "memberships", "workspaces",
    ]);
    expect(calls.rpc).toHaveBeenCalledWith(
      "servicedesk_register_owner_workspace",
      { p_name: saved.name, p_slug: saved.slug, p_timezone: "UTC", p_currency: "USD" },
    );
  });

  it("accepts a pre-existing genuinely owned workspace on a legitimate idempotent retry", async () => {
    workspaceRow = { ...saved, slug: "earlier-team", name: "Earlier Workspace", currency: "BDT" };
    calls.rpc.mockResolvedValueOnce({
      data: { ok: true, slug: "earlier-team", existing: true }, error: null,
    });
    expect(await destination()).toBe("/onboarding/verified?workspace=earlier-team");
    expect(calls.from).toHaveBeenCalledTimes(2);
  });

  it("explains database-controlled QA registration denial without a false success", async () => {
    calls.rpc.mockResolvedValueOnce({
      data: { ok: false, code: "REGISTRATION_NOT_AUTHORIZED" }, error: null,
    });
    expect(await destination()).toContain("not approved for this account");
    expect(calls.from).not.toHaveBeenCalled();
    expect(calls.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed on forged, incomplete or contradictory success receipts before readback", async () => {
    for (const data of [
      null,
      { ok: "true", slug: "synthetic-team", existing: false },
      { ok: true, slug: "../foreign", existing: false },
      { ok: true, slug: "synthetic--team", existing: false },
      { ok: true, slug: "synthetic-team" },
      { ok: true, slug: "synthetic-team", existing: "false" },
      { ok: true, slug: "synthetic-team", existing: null },
      { ok: true, slug: "synthetic-team", existing: false, code: "SLUG_UNAVAILABLE" },
      { ok: true, slug: "synthetic-team", existing: true, code: "UNEXPECTED" },
    ]) {
      calls.rpc.mockResolvedValueOnce({ data, error: null });
      expect(await destination()).toContain("/auth/create-workspace?error=");
      expect(calls.from).not.toHaveBeenCalled();
    }
  });

  it("does not claim success when a real post-RPC owner membership cannot be verified", async () => {
    memberRows = [];
    const href = await destination();
    expect(href).toContain("may have committed");
    expect(href).toContain("before trying again");
    expect(href).not.toContain("/onboarding/verified");
    expect(calls.from).toHaveBeenCalledTimes(1);
  });

  it("rejects an authenticated user change between write and readback", async () => {
    calls.getUser.mockResolvedValueOnce({
      data: { user: {
        id: ownerId, email: "approved@example.test",
        email_confirmed_at: "2026-10-26T00:00:00Z",
      } }, error: null,
    }).mockResolvedValueOnce({
      data: { user: { id: attackerId, email: "other@example.test" } },
      error: null,
    });
    expect(await destination()).toContain("saved owner access could not be verified");
    expect(calls.from).not.toHaveBeenCalled();
  });

  it("does not claim success when saved workspace details or RLS disagree", async () => {
    workspaceRow = { ...saved, currency: "GBP" };
    expect(await destination()).toContain("saved owner access could not be verified");
    expect(calls.from).toHaveBeenCalledTimes(2);
    workspaceRow = saved;
    memberError = true;
    expect(await destination()).toContain("saved owner access could not be verified");
  });

  it("never leaks raw provider failures or treats them as successful setup", async () => {
    calls.rpc.mockResolvedValueOnce({
      data: { ok: true, slug: "synthetic-team", existing: false },
      error: { message: "PRIVATE_DATABASE_SECRETS" },
    });
    const href = await destination();
    expect(href).toContain("Workspace setup is unavailable");
    expect(href).not.toContain("PRIVATE_DATABASE_SECRETS");
    expect(calls.from).not.toHaveBeenCalled();
  });

  it("enforces QA email, verified session and server approval before any RPC", async () => {
    calls.getUser.mockResolvedValueOnce({
      data: { user: { id: ownerId, email: "unapproved@example.test",
        email_confirmed_at: "2026-10-26T00:00:00Z" } }, error: null,
    });
    expect(await destination()).toContain("limited to approved test accounts");
    expect(calls.rpc).not.toHaveBeenCalled();

    calls.getUser.mockResolvedValueOnce({
      data: { user: { id: ownerId, email: "approved@example.test",
        email_confirmed_at: null } }, error: null,
    });
    expect(await destination()).toContain("/auth/sign-in?notice=");
    expect(calls.rpc).not.toHaveBeenCalled();

    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED", "false");
    expect(await destination()).toContain("not enabled on this environment");
    expect(calls.rpc).not.toHaveBeenCalled();
  });
});
