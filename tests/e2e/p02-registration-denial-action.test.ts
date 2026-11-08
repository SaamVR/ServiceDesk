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
const branchId = "55555555-5555-4555-8555-555555555555";
const savedBranch = { id: branchId, workspace_id: workspaceId, code: "MAIN",
  timezone: saved.timezone, currency: saved.currency, is_default: true, active: true };
const savedBranchMembership = { workspace_id: workspaceId, branch_id: branchId,
  user_id: ownerId, status: "ACTIVE" };

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
  let branchRows: unknown;
  let branchMembershipRows: unknown;
  let branchError: boolean;
  let branchMembershipError: boolean;

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
    branchRows = [savedBranch];
    branchMembershipRows = [savedBranchMembership];
    branchError = false;
    branchMembershipError = false;
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
      if (table === "workspace_branches") return {
        select() { return this; },
        eq() { return this; },
        async limit(value: number) {
          expect(value).toBe(2);
          return { data: branchRows, error: branchError ? { code: "42501" } : null };
        },
      };
      if (table === "branch_memberships") return {
        select() { return this; },
        eq() { return this; },
        async limit(value: number) {
          expect(value).toBe(2);
          return { data: branchMembershipRows,
            error: branchMembershipError ? { code: "42501" } : null };
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
      "memberships", "workspaces", "workspace_branches", "branch_memberships",
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
    expect(calls.from).toHaveBeenCalledTimes(4);
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

  it("never reports owner onboarding as ready when the MAIN branch or its assignment is missing", async () => {
    branchRows = [];
    let href = await destination();
    expect(href).toContain("saved owner access could not be verified");
    expect(href).not.toContain("/onboarding/verified");
    expect(calls.from.mock.calls.map(([table]) => table)).toEqual([
      "memberships", "workspaces", "workspace_branches",
    ]);
    branchRows = [savedBranch];
    branchMembershipRows = [{ ...savedBranchMembership, user_id: attackerId }];
    href = await destination();
    expect(href).toContain("saved owner access could not be verified");
    expect(href).not.toContain("/onboarding/verified");
    expect(calls.rpc).toHaveBeenCalledTimes(2); // One explicit action per owner submission; no implicit retry.
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

  it("never calls the registration RPC with a userless or malformed authenticated actor", async () => {
    for (const actor of [
      { email: "approved@example.test", email_confirmed_at: "2026-10-26T00:00:00Z" },
      { id: "", email: "approved@example.test", email_confirmed_at: "2026-10-26T00:00:00Z" },
      { id: "../foreign", email: "approved@example.test", email_confirmed_at: "2026-10-26T00:00:00Z" },
      { id: attackerId.slice(0, 20), email: "approved@example.test", email_confirmed_at: "2026-10-26T00:00:00Z" },
    ]) {
      calls.getUser.mockResolvedValueOnce({ data: { user: actor }, error: null });
      const href = await destination();
      expect(href).toContain("/auth/sign-in?notice=");
      expect(href).not.toContain("/onboarding/verified");
    }
    expect(calls.rpc).not.toHaveBeenCalled();
    expect(calls.from).not.toHaveBeenCalled();
  });

  it("does not invoke workspace registration when Auth identity verification throws", async () => {
    calls.getUser.mockRejectedValueOnce(Error("PRIVATE_AUTH_TRANSPORT"));
    const href = await destination();
    expect(href).toContain("/auth/sign-in?notice=");
    expect(href).not.toContain("PRIVATE_AUTH_TRANSPORT");
    expect(calls.rpc).not.toHaveBeenCalled();
    expect(calls.from).not.toHaveBeenCalled();
  });

  it("does not claim success or blindly resubmit after a possibly committed RPC times out", async () => {
    calls.rpc.mockRejectedValueOnce(Error("PRIVATE_POST_COMMIT_NETWORK_FAILURE"));
    const href = await destination();
    expect(href).toContain("/auth/create-workspace?error=");
    expect(href).toContain("may have committed");
    expect(href).toContain("authorized workspaces before trying again");
    expect(href).not.toContain("PRIVATE_POST_COMMIT_NETWORK_FAILURE");
    expect(href).not.toContain("/onboarding/verified");
    expect(calls.rpc).toHaveBeenCalledTimes(1);
    expect(calls.from).not.toHaveBeenCalled();
  });

});
