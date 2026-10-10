/**
 * Server-side public Supabase connection configuration.
 *
 * The modern publishable key is the preferred browser-safe credential; legacy
 * anon keys are supported for older installations. This module must NEVER
 * read, serialize or expose a service_role/secret key to the browser.
 */
export function supabasePublicConfig(env: Readonly<Record<string, string | undefined>> = process.env):
  | { url: string; publishableKey: string }
  | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.search || parsed.hash || parsed.pathname !== "/" ||
      !parsed.hostname.endsWith(".supabase.co")) return null;
  } catch {
    return null;
  }
  return { url, publishableKey };
}
