import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOwnerOnboardingWorkspaceChoice } from "../../src/features/onboarding/owner-onboarding-workspace-choice";

const person = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const north = "11111111-1111-4111-8111-111111111111";
const south = "22222222-2222-4222-8222-222222222222";
const foreign = "33333333-3333-4333-8333-333333333333";

interface OwnerRow { workspace_id: string }
interface WorkspaceRow { id: string; slug: string; name: string }

function fakeRls(
  members: OwnerRow[],
  workspaces: WorkspaceRow[],
  config: { membershipError?: boolean; workspaceError?: boolean; throwRead?: boolean } = {},
) {
  const calls: string[] = [];
  const memberQuery = {
    select(columns: string) { calls.push("membership-select:" + columns); return this; },
    eq(column: string, value: string) { calls.push("membership-filter:" + column + "=" + value); return this; },
    async limit(count: number) {
      calls.push("membership-limit:" + count);
      if (config.throwRead) throw Error("synthetic auth lookup outage");
      return { data: members, error: config.membershipError ? { code: "RLS_DENIED" } : null };
    },
  };
  const workspaceQuery = {
    select(columns: string) { calls.push("workspace-select:" + columns); return this; },
    in(column: string, ids: string[]) { calls.push("workspace-filter:" + column + "=" + ids.join(",")); return this; },
    async limit(count: number) {
      calls.push("workspace-limit:" + count);
      return { data: workspaces, error: config.workspaceError ? { code: "RLS_DENIED" } : null };
    },
  };
  const auth = {
    from(table: string) {
      calls.push("table:" + table);
      if (table === "memberships") return memberQuery;
      if (table === "workspaces") return workspaceQuery;
      throw Error("Unexpected table access " + table);
    },
  } as unknown as Pick<SupabaseClient, "from">;
  return { auth, calls };
}
const membership = (workspace_id: string) => ({ workspace_id });
const workspace = (id: string, slug: string, name: string): WorkspaceRow =>
  ({ id, slug, name });

describe("V4 onboarding explicit verified owner workspace selection", () => {
  it("keeps an owner with zero RLS-visible active businesses in the creation flow", async () => {
    const { auth, calls } = fakeRls([], []);
    expect(await resolveOwnerOnboardingWorkspaceChoice(auth, person)).toEqual({
      ok: true, kind: "NONE",
    });
    expect(calls).toContain("membership-filter:role=OWNER");
    expect(calls).toContain("membership-filter:status=ACTIVE");
    expect(calls).toContain("membership-filter:user_id=" + person);
    expect(calls).not.toContain("table:workspaces");
  });

  it("automatically selects only one verified owner business", async () => {
    const { auth } = fakeRls(
      [membership(north)],
      [workspace(north, "north-cleaning", "North Cleaning")],
    );
    expect(await resolveOwnerOnboardingWorkspaceChoice(auth, person)).toEqual({
      ok: true, kind: "SINGLE",
      workspace: workspace(north, "north-cleaning", "North Cleaning"),
    });
  });

  it("forces an explicit, stable choice when one account owns multiple businesses", async () => {
    const { auth, calls } = fakeRls(
      [membership(south), membership(north)],
      [
        workspace(south, "southern-cleaning", "Southern Cleaning"),
        workspace(north, "northern-cleaning", "Northern Cleaning"),
      ],
    );
    expect(await resolveOwnerOnboardingWorkspaceChoice(auth, person)).toEqual({
      ok: true, kind: "CHOOSE",
      workspaces: [
        workspace(north, "northern-cleaning", "Northern Cleaning"),
        workspace(south, "southern-cleaning", "Southern Cleaning"),
      ],
    });
    expect(calls).toContain("workspace-filter:id=" + south + "," + north);
    expect(calls).toContain("membership-limit:21");
    expect(calls).toContain("workspace-limit:21");
  });

  it("deduplicates repeated memberships without inventing a second business", async () => {
    const { auth, calls } = fakeRls(
      [membership(north), membership(north)],
      [workspace(north, "north-cleaning", "North Cleaning")],
    );
    expect(await resolveOwnerOnboardingWorkspaceChoice(auth, person))
      .toMatchObject({ ok: true, kind: "SINGLE" });
    expect(calls).toContain("workspace-filter:id=" + north);
  });

  it("fails closed when RLS hides one of several linked owner workspaces", async () => {
    const { auth } = fakeRls(
      [membership(north), membership(south)],
      [workspace(north, "north-cleaning", "North Cleaning")],
    );
    expect(await resolveOwnerOnboardingWorkspaceChoice(auth, person))
      .toEqual({ ok: false, code: "WORKSPACE_UNVERIFIED" });
  });

  it("never lists unrelated tenants or accepts invalid workspace slugs as a choice", async () => {
    const h = fakeRls(
      [membership(north)],
      [workspace(north, "north-cleaning", "North Cleaning"),
        workspace(foreign, "foreign-office", "Foreign Office")],
    );
    expect(await resolveOwnerOnboardingWorkspaceChoice(h.auth, person))
      .toMatchObject({ ok: true, kind: "SINGLE",
        workspace: { slug: "north-cleaning" } });
    const bad = fakeRls([membership(north)], [workspace(north, "../../evil", "Untrusted")]);
    expect(await resolveOwnerOnboardingWorkspaceChoice(bad.auth, person))
      .toEqual({ ok: false, code: "WORKSPACE_UNVERIFIED" });
  });

  it("fails closed on invalid users, excessive memberships and query errors", async () => {
    const over = fakeRls(Array.from({ length: 21 }, () => membership(north)), []);
    expect(await resolveOwnerOnboardingWorkspaceChoice(over.auth, person))
      .toEqual({ ok: false, code: "TOO_MANY" });
    expect(await resolveOwnerOnboardingWorkspaceChoice(over.auth, "invalid"))
      .toEqual({ ok: false, code: "MEMBERSHIP_UNVERIFIED" });
    const denied = fakeRls([membership(north)], [], { membershipError: true });
    expect(await resolveOwnerOnboardingWorkspaceChoice(denied.auth, person))
      .toEqual({ ok: false, code: "MEMBERSHIP_UNVERIFIED" });
    const outage = fakeRls([membership(north)], [], { throwRead: true });
    expect(await resolveOwnerOnboardingWorkspaceChoice(outage.auth, person))
      .toEqual({ ok: false, code: "WORKSPACE_UNVERIFIED" });
    const workspaceDenied = fakeRls(
      [membership(north)], [], { workspaceError: true },
    );
    expect(await resolveOwnerOnboardingWorkspaceChoice(workspaceDenied.auth, person))
      .toEqual({ ok: false, code: "WORKSPACE_UNVERIFIED" });
  });

  it("wires a verified owner chooser into onboarding rather than arbitrary limit-one routing", () => {
    const read = (path: string) =>
      readFileSync(join(process.cwd(), path), "utf8");
    const runtime = read("src/features/onboarding/onboarding-product-runtime.ts");
    const page = read("src/features/onboarding/OnboardingProductRoute.tsx");
    const selection = read("src/features/onboarding/owner-onboarding-workspace-choice.ts");
    expect(runtime).toContain("auth.auth.getUser()");
    expect(runtime).toContain("email_confirmed_at");
    expect(runtime).toContain("resolveOwnerOnboardingWorkspaceChoice(auth, data.user.id)");
    expect(runtime).toContain('kind: "selection"');
    expect(runtime).toContain("loadOperationalStaffSnapshot(slug)");
    expect(runtime).toContain('snapshot.value.actor.role !== "OWNER"');
    expect(runtime).not.toContain('.limit(1)');
    expect(page).toContain('result.kind === "selection"');
    expect(page).toContain('aria-label="Your authorized owner workspaces"');
    expect(page).toContain('encodeURIComponent(ownerWorkspace.slug)');
    expect(page).toContain("No workspace was selected on your behalf");
    expect(selection).not.toContain("service_role");
    expect(selection).not.toContain("user_metadata");
  });
});
