import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVerifiedOwnerWorkspace } from "../../src/features/auth/verified-owner-workspace";

const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const workspaceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const foreignId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const slug = "qa-cleaning";
const workspace = { id: workspaceId, slug, name: "QA Cleaning",
  timezone: "Asia/Dhaka", currency: "BDT" };

function fakeAuth(
  members: unknown,
  selectedWorkspace: unknown,
  flags: { membersError?: boolean; workspaceError?: boolean } = {},
) {
  const calls: string[] = [];
  const membershipQuery = {
    select() { return this; },
    eq() { return this; },
    async limit() {
      return { data: members, error: flags.membersError ? { code: "42501" } : null };
    },
  };
  const workspaceQuery = {
    select() { return this; },
    in() { calls.push("workspace-read"); return this; },
    eq() { return this; },
    async maybeSingle() {
      return { data: selectedWorkspace,
        error: flags.workspaceError ? { code: "42501" } : null };
    },
  };
  const auth = {
    from(table: string) {
      calls.push(table);
      if (table === "memberships") return membershipQuery;
      if (table === "workspaces") return workspaceQuery;
      throw Error("unanticipated table " + table);
    },
  } as unknown as SupabaseClient;
  return { auth, calls };
}

describe("P02 verified owner workspace readback cannot accept partial/corrupt tenant evidence", () => {
  it("accepts a full verified owner, matching saved membership and valid workspace shape", async () => {
    const { auth, calls } = fakeAuth([{ workspace_id: workspaceId }], workspace);
    expect(await loadVerifiedOwnerWorkspace(auth, user, slug))
      .toEqual({ ok: true, workspace });
    expect(calls).toContain("workspace-read");
  });

  it("fails closed before reading workspaces if membership response is partial or corrupt", async () => {
    for (const broken of [
      null, undefined, "unexpected", [{ workspace_id: workspaceId }, null],
      [{ workspace_id: workspaceId }, { workspace_id: "not-a-uuid" }],
      [{ workspace_id: workspaceId }, { workspace_id: "" }],
      [{ workspace_id: workspaceId }, { workspace_id: foreignId.slice(1) }],
      [{ workspace_id: 42 }], [{}],
    ]) {
      const { auth, calls } = fakeAuth(broken, workspace);
      expect(await loadVerifiedOwnerWorkspace(auth, user, slug))
        .toEqual({ ok: false, reason: "QUERY_FAILED" });
      expect(calls).toEqual(["memberships"]);
    }
  });

  it("denies a foreign slug and refuses incorrectly shaped workspace readback", async () => {
    for (const bad of [
      { ...workspace, id: foreignId }, { ...workspace, slug: "other-business" },
      { ...workspace, name: "" }, { ...workspace, timezone: null },
      { ...workspace, currency: "usd" }, { ...workspace, currency: "USDD" },
      { ...workspace, id: "bad" },
    ]) {
      expect(await loadVerifiedOwnerWorkspace(
        fakeAuth([{ workspace_id: workspaceId }], bad).auth, user, slug,
      )).not.toMatchObject({ ok: true });
    }
    expect(await loadVerifiedOwnerWorkspace(
      fakeAuth([{ workspace_id: workspaceId }], null).auth, user, slug,
    )).toEqual({ ok: false, reason: "DENIED" });
  });

  it("propagates actual auth/RLS read failures as failures without suggesting a new workspace", async () => {
    const members = [{ workspace_id: workspaceId }];
    expect(await loadVerifiedOwnerWorkspace(
      fakeAuth(members, workspace, { membersError: true }).auth, user, slug,
    )).toEqual({ ok: false, reason: "QUERY_FAILED" });
    expect(await loadVerifiedOwnerWorkspace(
      fakeAuth(members, workspace, { workspaceError: true }).auth, user, slug,
    )).toEqual({ ok: false, reason: "QUERY_FAILED" });
  });
});
