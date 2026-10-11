import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadVerifiedOwnerWorkspace, ownerAfterLoginHref } from "@/features/auth/verified-owner-workspace";

const ownId = "da5c10ef-0d3b-4f2c-9cce-df1b1d8b7ab0";
const otherId = "fcdebf16-d7ce-4571-840a-f8718bf5afe9";
type Member = { workspace_id: string };
type Workspace = { id: string; slug: string; name: string; timezone: string; currency: string };

function fakeClient(options: {
  members?: Member[];
  workspaces?: Workspace[];
  memberError?: boolean;
  workspaceError?: boolean;
}) {
  const calls: string[] = [];
  const members = {
    select(s: string) { calls.push("members-select:" + s); return this; },
    eq(k: string, v: string) { calls.push("member:" + k + "=" + v); return this; },
    async limit(n: number) {
      calls.push("limit:" + n);
      return { data: options.members ?? [], error: options.memberError ? { message: "RLS failure" } : null };
    },
  };
  let ids: string[] = [];
  let slug = "";
  const workspaces = {
    select(s: string) { calls.push("workspace-select:" + s); return this; },
    in(k: string, v: string[]) { calls.push("workspace-in:" + k); ids = v; return this; },
    eq(k: string, v: string) { calls.push("workspace-eq:" + k); if (k === "slug") slug = v; return this; },
    async maybeSingle() {
      const matched = (options.workspaces ?? []).find(w => ids.includes(w.id) && w.slug === slug) ?? null;
      return { data: matched, error: options.workspaceError ? { message: "Database denied" } : null };
    },
  };
  const client = {
    from(name: string) {
      if (name === "memberships") return members;
      if (name === "workspaces") return workspaces;
      throw new Error("Unexpected table " + name);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
const owned: Workspace = {
  id: ownId, slug: "brightroom-cleaning", name: "BrightRoom Cleaning",
  timezone: "America/New_York", currency: "USD",
};
const attacker: Workspace = {
  id: otherId, slug: "other-company", name: "Other Company",
  timezone: "America/New_York", currency: "USD",
};

describe("verified owner first-login RLS landing", () => {
  it("loads only the verified user's real owner workspace", async () => {
    const { client, calls } = fakeClient({ members: [{ workspace_id: ownId }], workspaces: [owned, attacker] });
    expect(await loadVerifiedOwnerWorkspace(client, "real-authenticated-user", owned.slug)).toEqual({
      ok: true, workspace: owned,
    });
    expect(calls).toContain("member:user_id=real-authenticated-user");
    expect(calls).toContain("member:role=OWNER");
    expect(calls).toContain("member:status=ACTIVE");
    expect(calls).toContain("workspace-in:id");
    expect(calls).toContain("workspace-eq:slug");
  });

  it("denies another workspace, even if it is visible to an improperly configured read facade", async () => {
    const { client } = fakeClient({ members: [{ workspace_id: ownId }], workspaces: [owned, attacker] });
    expect(await loadVerifiedOwnerWorkspace(client, "real-user", attacker.slug)).toEqual({
      ok: false, reason: "DENIED",
    });
    expect(await loadVerifiedOwnerWorkspace(client, "real-user", "missing-business")).toEqual({
      ok: false, reason: "DENIED",
    });
  });

  it("fails closed for anonymous, malformed slug, no membership, and excessive membership rows", async () => {
    const { client, calls } = fakeClient({ members: [{ workspace_id: ownId }], workspaces: [owned] });
    expect(await loadVerifiedOwnerWorkspace(client, "", owned.slug)).toEqual({ ok: false, reason: "INVALID" });
    expect(await loadVerifiedOwnerWorkspace(client, "user", "../admin")).toEqual({ ok: false, reason: "INVALID" });
    expect(calls).toEqual([]);
    const empty = fakeClient({ members: [] });
    expect(await loadVerifiedOwnerWorkspace(empty.client, "user", owned.slug)).toEqual({ ok: false, reason: "DENIED" });
    const crowded = fakeClient({ members: Array.from({ length: 21 }, () => ({ workspace_id: ownId })) });
    expect(await loadVerifiedOwnerWorkspace(crowded.client, "user", owned.slug)).toEqual({ ok: false, reason: "TOO_MANY" });
  });

  it("fails closed if any RLS query fails", async () => {
    const first = fakeClient({ memberError: true });
    expect(await loadVerifiedOwnerWorkspace(first.client, "user", owned.slug)).toEqual({ ok: false, reason: "QUERY_FAILED" });
    const second = fakeClient({ members: [{ workspace_id: ownId }], workspaceError: true });
    expect(await loadVerifiedOwnerWorkspace(second.client, "user", owned.slug)).toEqual({ ok: false, reason: "QUERY_FAILED" });
  });

  it("routes verified owners without operational secrets into real RLS-only welcome, not a broken staff dashboard", () => {
    const workspace = { slug: owned.slug, role: "OWNER", href: "/app/brightroom-cleaning/overview" };
    expect(ownerAfterLoginHref(workspace, {})).toBe("/onboarding/verified?workspace=brightroom-cleaning");
    expect(ownerAfterLoginHref(workspace, { SUPABASE_SERVICE_ROLE_KEY: "server-test-placeholder" })).toBe(workspace.href);
    expect(ownerAfterLoginHref({ ...workspace, role: "DISPATCHER" }, {})).toBe(workspace.href);
  });

  it("routes first workspace creation, continuation and workspace chooser consistently", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const action = read("src/app/auth/create-workspace/actions.ts");
    const continuation = read("src/app/auth/continue/route.ts");
    const chooser = read("src/app/auth/select-workspace/page.tsx");
    const welcome = read("src/app/onboarding/verified/page.tsx");
    expect(action).toContain('redirect("/onboarding/verified?workspace="');
    expect(continuation).toContain("ownerAfterLoginHref(decision.workspace)");
    expect(chooser).toContain("ownerAfterLoginHref(workspace)");
    expect(welcome).toContain("auth.auth.getUser()");
    expect(welcome).toContain("email_confirmed_at");
    expect(welcome).toContain("loadVerifiedOwnerWorkspace(auth, data.user.id, workspaceSlug)");
    expect(welcome).not.toContain("createClient(config.url, config.serviceRoleKey");
  });
});
