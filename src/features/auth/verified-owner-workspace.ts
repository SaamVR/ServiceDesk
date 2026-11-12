import { operationalDatabaseMode, type OperationalModeEnvironment } from "./operational-preview-mode";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface VerifiedOwnerWorkspace {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
}

type LookupResult =
  | { ok: true; workspace: VerifiedOwnerWorkspace }
  | { ok: false; reason: "INVALID" | "DENIED" | "QUERY_FAILED" | "TOO_MANY" };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Read the first owner workspace with the actual browser's authenticated
 * Supabase session and BOTH membership and workspace RLS. No service-role
 * key, JWT user_metadata, caller-chosen actor or privileged read is used.
 *
 * This permits a real verified owner to see successful onboarding while
 * the service-only operational backend is not yet configured in a preview.
 */
export async function loadVerifiedOwnerWorkspace(
  auth: SupabaseClient,
  userId: string,
  slug: string,
): Promise<LookupResult> {
  if (!UUID.test(userId) || !slugPattern.test(slug) ||
      slug.length < 3 || slug.length > 40) {
    return { ok: false, reason: "INVALID" };
  }

  // The caller-supplied user ID is never proof of account ownership. Validate
  // it against the *currently authenticated* Supabase user. This is in
  // addition to server-side getUser() checks in onboarding routes.
  // Never fall back to getSession() or unverified JWT user_metadata.
  let authenticatedId: string | undefined;
  try {
    const identity = await auth.auth.getUser();
    if (identity.error) return { ok: false, reason: "DENIED" };
    authenticatedId = identity.data?.user?.id;
  } catch {
    return { ok: false, reason: "QUERY_FAILED" };
  }
  if (!authenticatedId || authenticatedId !== userId) {
    return { ok: false, reason: "DENIED" };
  }

  // Request identity, role and active status as saved RLS-visible evidence.
  // A database result with just a workspace ID must not silently authorize.
  const readMembers = async () => await auth.from("memberships")
    .select("workspace_id,user_id,role,status")
    .eq("user_id", authenticatedId)
    .eq("role", "OWNER")
    .eq("status", "ACTIVE")
    .limit(21);
  const members = await readMembers().catch(() => null);
  if (!members) return { ok: false, reason: "QUERY_FAILED" };

  if (members.error || !Array.isArray(members.data)) {
    return { ok: false, reason: "QUERY_FAILED" };
  }
  if (members.data.length > 20) return { ok: false, reason: "TOO_MANY" };
  // Never accept a partly malformed, out-of-scope or duplicate membership
  // simply because another row appears valid.
  if (members.data.some(row => !row ||
      typeof row.workspace_id !== "string" || !UUID.test(row.workspace_id) ||
      row.user_id !== authenticatedId || row.role !== "OWNER" ||
      row.status !== "ACTIVE")) {
    return { ok: false, reason: "QUERY_FAILED" };
  }

  const ids = members.data.map(row => row.workspace_id);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, reason: "QUERY_FAILED" };
  }

  if (!ids.length) return { ok: false, reason: "DENIED" };
  const readWorkspace = async () => await auth.from("workspaces")
    .select("id,slug,name,timezone,currency")
    .in("id", ids)
    .eq("slug", slug)
    .maybeSingle();
  const workspace = await readWorkspace().catch(() => null);

  if (!workspace || workspace.error) return { ok: false, reason: "QUERY_FAILED" };
  const row = workspace.data;
  if (!row) return { ok: false, reason: "DENIED" };
  if (typeof row.id !== "string" || !UUID.test(row.id) ||
      !ids.includes(row.id) || row.slug !== slug ||
      typeof row.name !== "string" || !row.name.trim() || row.name.length > 160 ||
      typeof row.timezone !== "string" || row.timezone.length < 1 ||
      row.timezone.length > 100 ||
      typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency)) {
    return { ok: false, reason: "QUERY_FAILED" };
  }
  return { ok: true, workspace: {
    id: row.id,
    slug: row.slug,
    name: row.name,
    timezone: row.timezone,
    currency: row.currency,
  } };
}

/**
 * Independently verify that an already authenticated, RLS-proven OWNER has
 * one saved ACTIVE default branch and one saved ACTIVE assignment to it.
 * This is a read-only receipt, NOT an authorization bypass: callers must first
 * call loadVerifiedOwnerWorkspace using the browser's real Auth session.
 * New registrations additionally prove migration 0059's MAIN code and fields.
 * An existing owner may legitimately have renamed or reconfigured the branch.
 */
export async function verifySavedOwnerDefaultBranch(
  auth: SupabaseClient,
  userId: string,
  workspace: VerifiedOwnerWorkspace,
  newRegistration?: Omit<VerifiedOwnerWorkspace, "id">,
): Promise<boolean> {
  // Migration 0059 creates both MAIN and its owner branch membership in the
  // same transaction. RLS-visible workspace + OWNER rows alone cannot prove
  // first-run branch readiness. Never trust the registration JSON to certify it.
  const savedBranches = await (async () => await auth.from("workspace_branches")
    .select("id,workspace_id,code,timezone,currency,is_default,active")
    .eq("workspace_id", workspace.id)
    .eq("is_default", true)
    .eq("active", true)
    .limit(2))().catch(() => null);
  if (!savedBranches || savedBranches.error ||
      !Array.isArray(savedBranches.data) || savedBranches.data.length !== 1) {
    return false;
  }
  const branch = savedBranches.data[0];
  if (!branch || typeof branch.id !== "string" || !UUID.test(branch.id) ||
      branch.workspace_id !== workspace.id ||
      branch.is_default !== true || branch.active !== true ||
      typeof branch.code !== "string" ||
      !/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(branch.code) ||
      // An existing=true owner may have reconfigured branch settings, but
      // malformed billing settings cannot certify a ready workspace.
      typeof branch.timezone !== "string" || !branch.timezone.trim() ||
      branch.timezone.length > 100 ||
      typeof branch.currency !== "string" ||
      !/^[A-Z]{3}$/.test(branch.currency)) {
    return false;
  }
  // A new business requires its actual saved MAIN branch with matching billing
  // fields. Existing=true is an idempotent return to an older owned business,
  // whose default branch code/timezone/currency may legitimately have changed.
  if (newRegistration !== undefined &&
      (branch.code !== "MAIN" || branch.timezone !== newRegistration.timezone ||
       branch.currency !== newRegistration.currency)) {
    return false;
  }
  const savedBranchOwner = await (async () => await auth.from("branch_memberships")
    .select("workspace_id,branch_id,user_id,status")
    .eq("workspace_id", workspace.id)
    .eq("branch_id", branch.id)
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .limit(2))().catch(() => null);
  if (!savedBranchOwner || savedBranchOwner.error ||
      !Array.isArray(savedBranchOwner.data) || savedBranchOwner.data.length !== 1) {
    return false;
  }
  const assigned = savedBranchOwner.data[0];
  if (!assigned || assigned.workspace_id !== workspace.id ||
      assigned.branch_id !== branch.id || assigned.user_id !== userId ||
      assigned.status !== "ACTIVE") {
    return false;
  }

  return true;
}

/**
 * Verify a creation RPC against the caller's *saved*, RLS-visible owner row.
 * An existing=true response is the idempotent route of migration 0059: it
 * legitimately returns the owner's prior workspace rather than a new slug.
 * No response field alone is authoritative, including the existing flag.
 */
export async function verifyOwnerWorkspaceCreationReadback(
  auth: SupabaseClient,
  userId: string,
  requested: Omit<VerifiedOwnerWorkspace, "id">,
  response: unknown,
): Promise<
  | { ok: true; workspace: VerifiedOwnerWorkspace; existing: boolean }
  | { ok: false; reason: "RPC_UNVERIFIED" | "PERSISTENCE_UNVERIFIED" }
> {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return { ok: false, reason: "RPC_UNVERIFIED" };
  }
  const receipt = response as Record<string, unknown>;
  if (receipt.ok !== true || typeof receipt.slug !== "string" ||
      receipt.slug.length < 3 || receipt.slug.length > 40 ||
      !slugPattern.test(receipt.slug) ||
      (receipt.existing !== true && receipt.existing !== false)) {
    return { ok: false, reason: "RPC_UNVERIFIED" };
  }
  // A newly created business must have the exact submitted address. Only the
  // atomic RPC's existing=true path may legitimately point to an older one.
  if (receipt.existing === false && receipt.slug !== requested.slug) {
    return { ok: false, reason: "RPC_UNVERIFIED" };
  }

  const readback = await loadVerifiedOwnerWorkspace(auth, userId, receipt.slug);
  if (!readback.ok) return { ok: false, reason: "PERSISTENCE_UNVERIFIED" };
  if (receipt.existing === false && (
    readback.workspace.slug !== requested.slug ||
    readback.workspace.name !== requested.name ||
    readback.workspace.timezone !== requested.timezone ||
    readback.workspace.currency !== requested.currency
  )) {
    return { ok: false, reason: "PERSISTENCE_UNVERIFIED" };
  }
  if (!await verifySavedOwnerDefaultBranch(
    auth, userId, readback.workspace, receipt.existing === false ? requested : undefined,
  )) {
    return { ok: false, reason: "PERSISTENCE_UNVERIFIED" };
  }

  return { ok: true, workspace: readback.workspace, existing: receipt.existing };
}

/** Login never silently sends an owner into a staff backend without its key. */
export function ownerAfterLoginHref(
  workspace: { slug: string; role: string; href: string },
  env?: OperationalModeEnvironment,
): string {
  if (workspace.role === "OWNER" && operationalDatabaseMode(env) === "DISABLED") {
    return "/onboarding/verified?workspace=" + encodeURIComponent(workspace.slug);
  }
  return workspace.href;
}
