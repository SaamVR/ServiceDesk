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
