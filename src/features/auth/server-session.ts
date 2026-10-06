import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : undefined;
}

export async function hasAuthenticatedSession() {
  const config = authConfig();
  if (!config) return false;

  const cookieStore = await cookies();
  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Session refresh remains owned by the application auth layer.
      },
    },
  });

  const { data, error } = await auth.auth.getUser();
  return !error && Boolean(data.user);
}
