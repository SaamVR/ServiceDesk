import { operationalDatabaseMode } from "./operational-preview-mode";
import { ownerRegistrationMode } from "./owner-registration-readiness";

/**
 * Additional write authority for shared-database QA fixtures.
 * Being an allowed QA registrant never authorizes injecting demo customers
 * or requests into a primary ServiceDesk database by itself.
 *
 * Enable only after reviewed membership RLS and the target workspace have
 * been accepted, and only for intentionally synthetic QA business records.
 */
export function qaFixtureWritesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SERVICEDESK_QA_FIXTURE_WRITES_APPROVED === "true" &&
    env.SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED === "true" &&
    ownerRegistrationMode(env) === "QA_ONLY" &&
    operationalDatabaseMode({
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED: env.SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED,
      SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: env.SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED,
      SERVICEDESK_OWNER_REGISTRATION_ENABLED: env.SERVICEDESK_OWNER_REGISTRATION_ENABLED,
    }) === "QA_SESSION_RLS";
}


const QA_WORKSPACE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Main Supabase can contain real owner workspaces beside fictional QA ones.
 * An email allowlist and global QA permission cannot authorize every workspace
 * owned by that identity. Require a separately reviewed, exact slug allowlist.
 */
export function qaFixtureWritesAllowedForWorkspace(
  workspaceSlug: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!qaFixtureWritesAllowed(env) ||
      typeof workspaceSlug !== "string" || workspaceSlug.length < 3 ||
      workspaceSlug.length > 40 || !QA_WORKSPACE_SLUG.test(workspaceSlug)) return false;

  const raw = env.SERVICEDESK_QA_FIXTURE_WORKSPACE_SLUGS ?? "";
  if (!raw || raw.length > 419) return false;
  const parts = raw.split(",").map(slug => slug.trim());
  if (parts.length < 1 || parts.length > 10 ||
      parts.some(slug => slug.length < 3 || slug.length > 40 ||
        !QA_WORKSPACE_SLUG.test(slug)) || new Set(parts).size !== parts.length) return false;
  return parts.includes(workspaceSlug);
}
