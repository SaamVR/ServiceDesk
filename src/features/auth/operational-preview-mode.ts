/**
 * Operational backend mode. Full admin-backed operations remain the default.
 * A QA-only fallback may use *the authenticated user's* Supabase session,
 * so existing PostgreSQL RLS is stronger than an elevated service client.
 *
 * No anonymous transport, secret key, test fixture, or bypass of confirmed
 * identity/membership is permitted.
 */
export type OperationalDatabaseMode = "DISABLED" | "SERVICE_ROLE" | "QA_SESSION_RLS";

export interface OperationalModeEnvironment {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED?: string;
  SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED?: string;
  SERVICEDESK_OWNER_REGISTRATION_ENABLED?: string;
}

export function operationalDatabaseMode(
  env: OperationalModeEnvironment = {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED: process.env.SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED,
    SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: process.env.SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED,
    SERVICEDESK_OWNER_REGISTRATION_ENABLED: process.env.SERVICEDESK_OWNER_REGISTRATION_ENABLED,
  },
): OperationalDatabaseMode {
  if (env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return "SERVICE_ROLE";
  if (
    env.SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED === "true" &&
    env.SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED === "true" &&
    env.SERVICEDESK_OWNER_REGISTRATION_ENABLED !== "true"
  ) return "QA_SESSION_RLS";
  return "DISABLED";
}
