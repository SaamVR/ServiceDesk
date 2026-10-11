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
  if (!userId || !slugPattern.test(slug) || slug.length < 3 || slug.length > 40) {
    return { ok: false, reason: "INVALID" };
  }

  const members = await auth.from("memberships")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("role", "OWNER")
    .eq("status", "ACTIVE")
    .limit(21);

  if (members.error) return { ok: false, reason: "QUERY_FAILED" };
  if ((members.data ?? []).length > 20) return { ok: false, reason: "TOO_MANY" };

  const ids = [...new Set((members.data ?? [])
    .map(row => row.workspace_id)
    .filter((id): id is string => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id)))];

  if (!ids.length) return { ok: false, reason: "DENIED" };
  const workspace = await auth.from("workspaces")
    .select("id,slug,name,timezone,currency")
    .in("id", ids)
    .eq("slug", slug)
    .maybeSingle();

  if (workspace.error) return { ok: false, reason: "QUERY_FAILED" };
  const row = workspace.data;
  if (!row || !ids.includes(row.id) || row.slug !== slug) return { ok: false, reason: "DENIED" };
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
  env: { SUPABASE_SERVICE_ROLE_KEY?: string } = { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY },
): string {
  if (workspace.role === "OWNER" && !env.SUPABASE_SERVICE_ROLE_KEY) {
    return "/onboarding/verified?workspace=" + encodeURIComponent(workspace.slug);
  }
  return workspace.href;
}
