import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  return url && publishableKey ? { url, publishableKey } : undefined;
}

export async function refreshAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = authConfig();

  if (!config) {
    return response;
  }

  const auth = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });

  await auth.auth.getClaims();
  return response;
}
