import { verifiedEmailRedirectOrigin } from "./email-origin";

/**
 * Self-service OWNER registration is a deployment-controlled capability.
 * The operator must first rehearse and apply 0024..0059 on an authorized
 * nonproduction database and verify email confirmation delivery.
 * Existing-user sign-in and password recovery do not depend on this flag.
 */
export function ownerRegistrationAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;
  const origin = verifiedEmailRedirectOrigin(
    env.SERVICEDESK_AUTH_REDIRECT_ORIGIN,
    env.RENDER_EXTERNAL_URL,
  );
  return env.SERVICEDESK_OWNER_REGISTRATION_ENABLED === "true" &&
    Boolean(url && key && origin);
}
