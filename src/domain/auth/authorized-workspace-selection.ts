/**
 * Deterministic navigation for *already authorized* Supabase membership rows.
 *
 * This is not an authentication or permission boundary: its input MUST come
 * from a server-side query restricted by the current user's Supabase RLS.
 * Every destination must still enforce tenant membership independently.
 */
export type StaffWorkspaceRole = "OWNER" | "DISPATCHER";
export type WorkspaceRole = StaffWorkspaceRole | "CREW";

export interface AuthorizedWorkspaceMembership {
  workspaceId: string;
  slug: string;
  name: string;
  role: string;
  status: string;
}

export interface AuthorizedStaffDestination {
  workspaceId: string;
  slug: string;
  name: string;
  role: StaffWorkspaceRole;
  href: string;
}

export type AuthorizedWorkspaceDecision =
  | { kind: "NONE" }
  | { kind: "CREW"; href: "/crew/today" }
  | { kind: "STAFF"; workspace: AuthorizedStaffDestination; href: string }
  | { kind: "CHOOSE"; workspaces: AuthorizedStaffDestination[] };

const staffRoleRank: Record<StaffWorkspaceRole, number> = {
  OWNER: 0,
  DISPATCHER: 1,
};

function allowedSlug(slug: unknown): slug is string {
  // Schema types describe expected DB shape, not proof that connector rows
  // or partially migrated workspaces always preserve it at runtime.
  return typeof slug === "string" && slug.length >= 3 && slug.length <= 40 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function validWorkspaceId(value: unknown): value is string {
  // Domain IDs may be non-UUID in unit fixtures, but never arbitrary paths.
  return typeof value === "string" && value.length > 0 && value.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * Resolve navigation only; never grant access based on an input slug/role.
 * Conflicting same-workspace roles collapse to the highest authorized role.
 * Users with more than one staff workspace must explicitly choose.
 */
export function resolveAuthorizedWorkspaceDestination(
  rows: readonly AuthorizedWorkspaceMembership[],
): AuthorizedWorkspaceDecision {
  const staff = new Map<string, AuthorizedStaffDestination>();
  // A membership join must not map the same immutable workspace ID to
  // different slugs. Fail closed rather than making routing row-order-dependent.
  const conflictingSlugs = new Set<string>();
  let hasCrewAccess = false;

  for (const row of rows) {
    if (row.status !== "ACTIVE" || !validWorkspaceId(row.workspaceId)) continue;
    if (row.role === "CREW") {
      hasCrewAccess = true;
      continue;
    }
    if (row.role !== "OWNER" && row.role !== "DISPATCHER") continue;
    if (!allowedSlug(row.slug)) continue;

    const next: AuthorizedStaffDestination = {
      workspaceId: row.workspaceId,
      slug: row.slug,
      name: (typeof row.name === "string" ? row.name.trim().slice(0, 120) : "") || row.slug,
      role: row.role,
      href: "/app/" + encodeURIComponent(row.slug) + "/overview",
    };
    if (conflictingSlugs.has(row.workspaceId)) continue;
    const previous = staff.get(row.workspaceId);
    if (previous && previous.slug !== next.slug) {
      conflictingSlugs.add(row.workspaceId);
      staff.delete(row.workspaceId);
      continue;
    }
    if (!previous || staffRoleRank[next.role] < staffRoleRank[previous.role] ||
      (next.role === previous.role && next.name.localeCompare(previous.name) < 0)) {
      staff.set(row.workspaceId, next);
    }
  }

  const workspaces = [...staff.values()].sort((a, b) => (
    staffRoleRank[a.role] - staffRoleRank[b.role] ||
    a.name.localeCompare(b.name) ||
    a.workspaceId.localeCompare(b.workspaceId)
  ));

  if (workspaces.length > 1) return { kind: "CHOOSE", workspaces };
  if (workspaces.length === 1) return {
    kind: "STAFF",
    workspace: workspaces[0],
    href: workspaces[0].href,
  };
  if (hasCrewAccess) return { kind: "CREW", href: "/crew/today" };
  return { kind: "NONE" };
}

/**
 * Complete an explicit workspace choice against the same RLS-scoped rows used
 * to build the chooser. A URL, selected slug, or client-supplied role cannot
 * authorize entry into a workspace: the chosen ID must be present in the
 * authenticated active staff membership result.
 *
 * This is navigation policy only. The destination must independently
 * authenticate and authorize the current user.
 */
export function resolveAuthorizedStaffWorkspaceSelection(
  rows: readonly AuthorizedWorkspaceMembership[],
  requestedWorkspaceId: string,
): Extract<AuthorizedWorkspaceDecision, { kind: "STAFF" }> | { kind: "NONE" } {
  if (!validWorkspaceId(requestedWorkspaceId)) return { kind: "NONE" };
  const decision = resolveAuthorizedWorkspaceDestination(rows);
  const workspace = decision.kind === "STAFF"
    ? (decision.workspace.workspaceId === requestedWorkspaceId ? decision.workspace : undefined)
    : decision.kind === "CHOOSE"
      ? decision.workspaces.find(candidate => candidate.workspaceId === requestedWorkspaceId)
      : undefined;
  return workspace ? { kind: "STAFF", workspace, href: workspace.href } : { kind: "NONE" };
}
