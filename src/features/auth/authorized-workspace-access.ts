import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveAuthorizedWorkspaceDestination,
  type AuthorizedWorkspaceDecision,
  type AuthorizedWorkspaceMembership,
} from "@/domain/auth/authorized-workspace-selection";

export type WorkspaceAccessLoad =
  | { ok: true; decision: AuthorizedWorkspaceDecision }
  | { ok: false; code: "MEMBERSHIP_LOOKUP" | "MEMBERSHIP_LIMIT" | "WORKSPACE_LOOKUP" };

interface MembershipRow { workspace_id: string; user_id: string; role: string; status: string }
interface WorkspaceRow { id: string; slug: string; name: string }

/**
 * Source of truth is the current verified Supabase session and authenticated
 * row-level security, never user_metadata, URL slugs or browser-provided roles.
 *
 * This is only a navigation query. Protected staff pages must authorize again.
 */
export async function loadAuthorizedWorkspaceDecision(
  client: SupabaseClient,
  verifiedUserId: string,
): Promise<WorkspaceAccessLoad> {
  if (typeof verifiedUserId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(verifiedUserId))
    return { ok: false, code: "MEMBERSHIP_LOOKUP" };
  const membership = await client.from("memberships")
    .select("workspace_id,user_id,role,status")
    .eq("user_id", verifiedUserId)
    .eq("status", "ACTIVE")
    .limit(101);
  if (membership.error) return { ok: false, code: "MEMBERSHIP_LOOKUP" };

  // A filtered response is not proof of identity. Verify each saved row
  // against the verified caller; never grant navigation from a corrupt row.
  if (!Array.isArray(membership.data))
    return { ok: false, code: "MEMBERSHIP_LOOKUP" };
  const members = membership.data as MembershipRow[];
  if (members.length > 100) return { ok: false, code: "MEMBERSHIP_LIMIT" };
  if (members.some(row => !row || typeof row !== "object" ||
      row.user_id !== verifiedUserId || row.status !== "ACTIVE" ||
      !["OWNER", "DISPATCHER", "CREW"].includes(row.role) ||
      typeof row.workspace_id !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(row.workspace_id)))
    return { ok: false, code: "MEMBERSHIP_LOOKUP" };
  const staffIds = [...new Set(members
    .filter(row => row.status === "ACTIVE" &&
      (row.role === "OWNER" || row.role === "DISPATCHER"))
    .map(row => row.workspace_id)
    .filter(id => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id)))];

  let workspaceRows: WorkspaceRow[] = [];
  if (staffIds.length) {
    // This query also runs as the authenticated user under workspace RLS.
    const result = await client.from("workspaces")
      .select("id,slug,name")
      .in("id", staffIds)
      .limit(101);
    if (result.error) return { ok: false, code: "WORKSPACE_LOOKUP" };
    if (!Array.isArray(result.data))
      return { ok: false, code: "WORKSPACE_LOOKUP" };
    workspaceRows = result.data as WorkspaceRow[];
    if (workspaceRows.length > 100) return { ok: false, code: "WORKSPACE_LOOKUP" };
    if (workspaceRows.some(row => !row || typeof row !== "object" ||
        !staffIds.includes(row.id) || typeof row.slug !== "string" ||
        typeof row.name !== "string") ||
        new Set(workspaceRows.map(row => row.id)).size !== workspaceRows.length)
      return { ok: false, code: "WORKSPACE_LOOKUP" };
  }

  const workspaceById = new Map<string, WorkspaceRow[]>();
  for (const row of workspaceRows) {
    const list = workspaceById.get(row.id) ?? [];
    list.push(row);
    workspaceById.set(row.id, list);
  }

  const authorizedRows: AuthorizedWorkspaceMembership[] = members.flatMap(row => {
    if (row.status !== "ACTIVE") return [];
    if (row.role === "CREW") {
      return [{ workspaceId: row.workspace_id, slug: "", name: "", role: row.role, status: row.status }];
    }
    return (workspaceById.get(row.workspace_id) ?? []).map(workspace => ({
      workspaceId: row.workspace_id,
      slug: workspace.slug,
      name: workspace.name,
      role: row.role,
      status: row.status,
    }));
  });

  return { ok: true, decision: resolveAuthorizedWorkspaceDestination(authorizedRows) };
}
