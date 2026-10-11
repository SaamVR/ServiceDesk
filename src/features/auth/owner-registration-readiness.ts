import { verifiedEmailRedirectOrigin } from "./email-origin";

/**
 * Public registration remains off until full provider and operational
 * acceptance. QA mode permits only a small, server-configured email allowlist
 * against the isolated staging database. Neither mode bypasses Supabase
 * email verification, password policy, RLS or the verified-owner RPC.
 */
export type OwnerRegistrationMode = "DISABLED" | "QA_ONLY" | "PUBLIC";

function hasValidAuthConfig(env: NodeJS.ProcessEnv): boolean {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;
  const origin = verifiedEmailRedirectOrigin(
    env.SERVICEDESK_AUTH_REDIRECT_ORIGIN,
    env.RENDER_EXTERNAL_URL,
  );
  return Boolean(url && key && origin);
}

function qaAllowlist(env: NodeJS.ProcessEnv): string[] {
  const raw = env.SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS ?? "";
  if (raw.length > 2_540) return [];
  const parts = raw.split(",");
  if (parts.some(value => !value.trim())) return [];
  const values = parts.map(value => value.trim().toLowerCase());
  if (values.length < 1 || values.length > 10 ||
      values.some(value => value.length > 254 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value))) {
    return [];
  }
  return [...new Set(values)];
}

export function ownerRegistrationMode(env: NodeJS.ProcessEnv = process.env): OwnerRegistrationMode {
  if (!hasValidAuthConfig(env)) return "DISABLED";
  if (env.SERVICEDESK_OWNER_REGISTRATION_ENABLED === "true") return "PUBLIC";
  if (env.SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED === "true" && qaAllowlist(env).length) {
    return "QA_ONLY";
  }
  return "DISABLED";
}

/** Enables the form and guarded Server Actions only in an accepted mode. */
export function ownerRegistrationAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return ownerRegistrationMode(env) !== "DISABLED";
}

/** Marketing and public CTA must not advertise limited QA registration. */
export function ownerRegistrationPubliclyAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return ownerRegistrationMode(env) === "PUBLIC";
}

/** Also enforced in Server Actions; form visibility is not authorization. */
export function ownerRegistrationEmailAllowed(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!email || email.length > 254) return false;
  const mode = ownerRegistrationMode(env);
  if (mode === "PUBLIC") return true;
  if (mode !== "QA_ONLY") return false;
  return qaAllowlist(env).includes(email.trim().toLowerCase());
}
