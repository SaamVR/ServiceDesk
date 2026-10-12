import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface OwnerOnboardingWorkspace {
  id: string;
  slug: string;
  name: string;
}

export type OwnerOnboardingChoice =
  | { ok: true; kind: "NONE" }
  | { ok: true; kind: "SINGLE"; workspace: OwnerOnboardingWorkspace }
  | { ok: true; kind: "CHOOSE"; workspaces: OwnerOnboardingWorkspace[] }
  | { ok: false; code: "MEMBERSHIP_UNVERIFIED" | "WORKSPACE_UNVERIFIED" | "TOO_MANY" };

/**
 * A navigation-only lookup under the *signed-in user's* Supabase RLS.
 * This cannot grant staff/owner access and never uses a service-role client.
 * Protected workspace routes must authorize again.
 */
export async function resolveOwnerOnboardingWorkspaceChoice(
  auth: Pick<SupabaseClient, "from">,
  verifiedUserId: string,
): Promise<OwnerOnboardingChoice> {
  if (!UUID.test(verifiedUserId)) return { ok: false, code: "MEMBERSHIP_UNVERIFIED" };
  try {
    const membership = await auth.from("memberships")
      .select("workspace_id")
      .eq("user_id", verifiedUserId)
      .eq("role", "OWNER")
      .eq("status", "ACTIVE")
      .limit(21);

    if (membership.error || !Array.isArray(membership.data)) {
      return { ok: false, code: "MEMBERSHIP_UNVERIFIED" };
    }
    if (membership.data.length > 20) return { ok: false, code: "TOO_MANY" };

    // A duplicate membership must never create two apparent businesses.
    const ids = [...new Set(membership.data
      .map(row => row.workspace_id)
      .filter((id): id is string => typeof id === "string" && UUID.test(id)))];
    if (!ids.length) return { ok: true, kind: "NONE" };
    if (ids.length > 20) return { ok: false, code: "TOO_MANY" };

    const workspaces = await auth.from("workspaces")
      .select("id,slug,name")
      .in("id", ids)
      .limit(21);

    if (workspaces.error || !Array.isArray(workspaces.data)) {
      return { ok: false, code: "WORKSPACE_UNVERIFIED" };
    }
    if (workspaces.data.length > 20) return { ok: false, code: "TOO_MANY" };

    const owned = new Set(ids);
    const seen = new Set<string>();
    const authorized: OwnerOnboardingWorkspace[] = [];
    for (const row of workspaces.data) {
      if (typeof row.id !== "string" || !owned.has(row.id) ||
          typeof row.slug !== "string" || row.slug.length < 3 ||
          row.slug.length > 40 || !SLUG.test(row.slug) ||
          typeof row.name !== "string" || !row.name.trim() ||
          row.name.length > 160 || seen.has(row.id)) continue;
      seen.add(row.id);
      authorized.push({ id: row.id, slug: row.slug, name: row.name.trim() });
    }
    // Do not silently select a workspace if RLS has hidden another membership;
    // require the owner to retry rather than guessing which tenant is intended.
    if (authorized.length !== ids.length) {
      return { ok: false, code: "WORKSPACE_UNVERIFIED" };
    }
    authorized.sort((a, b) =>
      a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
    if (authorized.length === 1) return { ok: true, kind: "SINGLE", workspace: authorized[0] };
    return { ok: true, kind: "CHOOSE", workspaces: authorized };
  } catch {
    return { ok: false, code: "WORKSPACE_UNVERIFIED" };
  }
}
