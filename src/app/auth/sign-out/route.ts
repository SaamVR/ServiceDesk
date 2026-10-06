import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : undefined;
}

export async function POST(request: NextRequest) {
  const destination = new URL(
    "/auth/sign-in?notice=" + encodeURIComponent("You have been signed out."),
    request.url,
  );
  const response = NextResponse.redirect(destination, 303);
  const config = authConfig();

  if (!config) {
    return response;
  }

  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await auth.auth.signOut();
  return response;
}
