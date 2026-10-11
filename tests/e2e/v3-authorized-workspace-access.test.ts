import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAuthorizedWorkspaceDecision } from "../../src/features/auth/authorized-workspace-access";

interface Member { workspace_id: string; role: string; status: string }
interface Workspace { id: string; slug: string; name: string }

function fakeRlsClient(
  members: Member[],
  workspaces: Workspace[],
  membershipError = false,
  workspaceError = false,
) {
  const calls: string[] = [];
  const membershipQuery = {
    select(columns: string) { calls.push("members:" + columns); return this; },
    eq(column: string, value: string) { calls.push(column + ":" + value); return this; },
    async limit(n: number) {
      calls.push("member-limit:" + n);
      return { data: members, error: membershipError ? { message: "synthetic failure" } : null };
    },
  };
  const workspaceQuery = {
    select(columns: string) { calls.push("workspaces:" + columns); return this; },
    in(column: string, ids: string[]) { calls.push(column + ":" + ids.join(",")); return this; },
    async limit(n: number) {
      calls.push("workspace-limit:" + n);
      return { data: workspaces, error: workspaceError ? { message: "synthetic failure" } : null };
    },
  };
  const client = {
    from(table: string) {
      if (table === "memberships") return membershipQuery;
      if (table === "workspaces") return workspaceQuery;
      throw new Error("Unexpected query: " + table);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
const member = (workspace_id: string, role: string, status = "ACTIVE"): Member =>
  ({ workspace_id, role, status });
const workspace = (id: string, slug: string): Workspace =>
  ({ id, slug, name: "Office " + id });

describe("verified authenticated RLS workspace discovery", () => {
  it("does not invent membership for an account without workspaces", async () => {
    const { client, calls } = fakeRlsClient([], []);
    expect(await loadAuthorizedWorkspaceDecision(client, "user-1")).toEqual({
      ok: true, decision: { kind: "NONE" },
    });
    expect(calls).toContain("user_id:user-1");
    expect(calls).not.toContain("workspaces:id,slug,name");
  });

  it("offers explicit selection for two RLS-visible staff memberships", async () => {
    const { client, calls } = fakeRlsClient(
      [member("one", "OWNER"), member("two", "DISPATCHER"), member("crew", "CREW")],
      [workspace("one", "north-office"), workspace("two", "south-office")],
    );
    const result = await loadAuthorizedWorkspaceDecision(client, "verified-owner");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.kind).toBe("CHOOSE");
      if (result.decision.kind === "CHOOSE") {
        expect(result.decision.workspaces.map(w => w.slug)).toEqual(["north-office", "south-office"]);
        expect(result.decision.workspaces.every(w => w.href.startsWith("/app/"))).toBe(true);
      }
    }
    expect(calls).toContain("status:ACTIVE");
    expect(calls).toContain("id:one,two");
  });

  it("never enters a staff workspace hidden by RLS", async () => {
    const { client } = fakeRlsClient([member("secret", "OWNER")], []);
    expect(await loadAuthorizedWorkspaceDecision(client, "verified-user")).toEqual({
      ok: true, decision: { kind: "NONE" },
    });
  });

  it("preserves crew fallback and skips any staff-table read for crew only", async () => {
    const { client, calls } = fakeRlsClient([member("crew", "CREW")], []);
    expect(await loadAuthorizedWorkspaceDecision(client, "verified-user")).toEqual({
      ok: true, decision: { kind: "CREW", href: "/crew/today" },
    });
    expect(calls).not.toContain("workspaces:id,slug,name");
  });

  it("fails closed when RLS queries fail, or membership query is truncated", async () => {
    const failed = fakeRlsClient([member("one", "OWNER")], [], true);
    expect(await loadAuthorizedWorkspaceDecision(failed.client, "verified-user"))
      .toMatchObject({ ok: false, code: "MEMBERSHIP_LOOKUP" });

    const workspacesFailed = fakeRlsClient([member("one", "OWNER")], [], false, true);
    expect(await loadAuthorizedWorkspaceDecision(workspacesFailed.client, "verified-user"))
      .toMatchObject({ ok: false, code: "WORKSPACE_LOOKUP" });

    const overLimit = fakeRlsClient(Array.from({ length: 101 }, (_, n) =>
      member("ws" + n, "OWNER")), []);
    expect(await loadAuthorizedWorkspaceDecision(overLimit.client, "verified-user"))
      .toMatchObject({ ok: false, code: "MEMBERSHIP_LIMIT" });
    expect(await loadAuthorizedWorkspaceDecision(overLimit.client, ""))
      .toMatchObject({ ok: false, code: "MEMBERSHIP_LOOKUP" });
  });

  it("continuation and chooser use the same RLS-backed decision, never URL-supplied roles", () => {
    const file = (name: string) => readFileSync(join(process.cwd(), name), "utf8");
    const continuation = file("src/app/auth/continue/route.ts");
    const chooser = file("src/app/auth/select-workspace/page.tsx");
    expect(continuation).toContain('loadAuthorizedWorkspaceDecision(auth, data.user.id)');
    expect(continuation).toContain('decision.kind === "CHOOSE"');
    expect(continuation).toContain('"/auth/select-workspace"');
    expect(chooser).toContain('auth.auth.getUser()');
    expect(chooser).toContain("email_confirmed_at");
    expect(chooser).toContain('href={ownerAfterLoginHref(workspace)}');
    expect(chooser).not.toContain("user_metadata");
    expect(chooser).not.toContain("service_role");
  });
});
